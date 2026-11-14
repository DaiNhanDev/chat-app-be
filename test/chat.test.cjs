const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, api } = require('./helpers.cjs');
const input = { clientMessageId: 'client-1', text: 'Hello' };
const endpoint = '/conversations/room/messages';

test('all feature endpoints require verified Firebase identity, rejecting JWT or malformed headers', async (t) => {
  const f = fixture();
  const request = await api(t, f);
  for (const [method, path, body] of [
    ['POST', endpoint, input],
    ['PUT', '/push/devices/browser', { token: 'test-registration' }],
    ['DELETE', '/push/devices/browser'],
  ]) {
    for (const token of [null, 'untrusted-jwt', 'id-alice extra']) {
      assert.equal((await request(method, path, body, token)).status, 401);
    }
  }
  assert.equal(f.db.read('_server'), null);
});

test('non-member cannot save a message or trigger push', async (t) => {
  const f = fixture();
  const request = await api(t, f);
  assert.equal((await request('POST', endpoint, input, 'id-outsider')).status, 403);
  assert.equal(f.db.read('rooms/room/messages'), null);
  assert.equal(f.sender.calls.length, 0);
});

test('HTTP message save preserves the existing room format and uses server identity/time', async (t) => {
  const f = fixture();
  const request = await api(t, f);
  const before = Date.now();
  const response = await request('POST', endpoint, { clientId: 'client-1', text: ' Hello ' });
  assert.equal(response.status, 201);
  const saved = f.db.read('rooms/room');
  assert.deepEqual(saved.messages['client-1'], {
    senderId: 'alice',
    text: 'Hello',
    createdAt: response.body.data.message.createdAt,
  });
  assert.ok(saved.messages['client-1'].createdAt >= before);
  assert.equal(saved.info.lastMessage, 'Hello');
  assert.equal(saved.info.lastMessageId, 'client-1');
  assert.equal(saved.info.lastSenderId, 'alice');
  assert.equal(saved.info.updatedAt, saved.messages['client-1'].createdAt);
  assert.equal(saved.info.customMetadata, 'preserve');
  assert.deepEqual(saved.unrelated, { keep: true });
  assert.equal(saved.info.createdAt, 1000);
  for (const field of ['senderId', 'recipientIds', 'createdAt', 'url']) {
    assert.equal((await request('POST', endpoint, { ...input, [field]: 'forged' })).status, 422);
  }
  for (const body of [
    { ...input, text: ' ' },
    { ...input, text: 'a'.repeat(4001) },
    { ...input, clientMessageId: '../escape' },
    { ...input, clientMessageId: '__proto__' },
  ]) {
    assert.equal((await request('POST', endpoint, body)).status, 422);
  }
});

test('concurrent HTTP retries create one message, preserve time, and trigger one push', async (t) => {
  const f = fixture();
  await f.devices.register('bob', 'bob-browser', 'bob-registration');
  await f.devices.register('alice', 'alice-browser', 'alice-registration');
  const request = await api(t, f);
  const responses = await Promise.all(
    Array.from({ length: 12 }, () => request('POST', endpoint, input)),
  );
  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(responses.filter((response) => response.status === 200).length, 11);
  assert.equal(Object.keys(f.db.read('rooms/room/messages')).length, 1);
  assert.equal(new Set(responses.map((response) => response.body.data.message.createdAt)).size, 1);
  assert.equal(f.sender.calls.length, 1);
  assert.deepEqual(f.sender.calls[0].tokens, ['bob-registration']);
  assert.equal(f.sender.calls[0].notification.body, 'Bạn có tin nhắn mới');
  assert.ok(!JSON.stringify(f.sender.calls[0]).includes('Hello'));
  assert.equal(
    f.sender.calls[0].webpush.fcmOptions.link,
    'https://chat.example.com/?conversationId=room',
  );
  assert.equal((await request('POST', endpoint, { ...input, text: 'Changed' })).status, 409);
  assert.equal((await request('POST', endpoint, input, 'id-bob')).status, 409);
  assert.equal(f.sender.calls.length, 1);
});

test('membership is checked again inside the transaction', async () => {
  const f = fixture();
  const realRef = f.db.ref.bind(f.db);
  f.db.ref = (path) => {
    const ref = realRef(path);
    const read = ref.get;
    ref.get = async () => {
      const old = await read();
      f.db.data.rooms.room.info.memberIds.alice = false;
      return old;
    };
    return ref;
  };
  await assert.rejects(f.chat.send('room', 'alice', input), (error) => error.statusCode === 403);
  assert.equal(f.db.read('rooms/room/messages'), null);
});

test('RTDB write failure never dispatches FCM', async (t) => {
  const f = fixture();
  await f.devices.register('bob', 'browser', 'registration');
  f.db.failWrites = true;
  const request = await api(t, f);
  assert.equal((await request('POST', endpoint, input)).status, 500);
  assert.equal(f.db.read('rooms/room/messages'), null);
  assert.equal(f.sender.calls.length, 0);
});

test('FCM failure still returns a saved message and a replay does not dispatch again', async (t) => {
  const f = fixture({
    send: async () => {
      throw new Error('Simulated FCM failure');
    },
  });
  await f.devices.register('bob', 'browser', 'registration');
  const request = await api(t, f);
  assert.equal((await request('POST', endpoint, input)).status, 201);
  assert.equal(f.db.read('rooms/room/messages/client-1').text, 'Hello');
  assert.equal((await request('POST', endpoint, input)).status, 200);
  assert.equal(f.sender.calls.length, 1);
});

test('a hanging FCM operation is bounded, tracked and drained after it settles', async () => {
  let complete;
  const f = fixture({
    timeoutMs: 20,
    send: () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  });
  await f.devices.register('bob', 'browser', 'registration');
  const startedAt = Date.now();
  const result = await f.chat.send('room', 'alice', input);
  assert.equal(result.message.text, 'Hello');
  assert.ok(Date.now() - startedAt < 1000);
  assert.equal(f.push.pending.size, 1);
  complete({ successCount: 1, failureCount: 0, responses: [{ success: true }] });
  await f.push.drain(100);
  assert.equal(f.push.pending.size, 0);
});

test('concurrent distinct messages preserve each other and metadata follows the winning commit', async () => {
  const f = fixture();
  await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      f.chat.send('room', 'alice', {
        clientMessageId: `unique-${index}`,
        text: `Message ${index}`,
      }),
    ),
  );
  const room = f.db.read('rooms/room');
  assert.equal(Object.keys(room.messages).length, 8);
  assert.equal(room.info.lastMessage, room.messages[room.info.lastMessageId].text);
  assert.equal(room.info.updatedAt, room.messages[room.info.lastMessageId].createdAt);
  assert.equal(room.info.customMetadata, 'preserve');
});
