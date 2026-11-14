const test = require('node:test');
const assert = require('node:assert/strict');
const { fixture, api } = require('./helpers.cjs');
const { conversationLink } = require('../dist/services/push.service');

test('multiple devices, duplicate tokens, token rotation, owner-scoped deletion and account switching', async (t) => {
  const f = fixture();
  const request = await api(t, f);
  assert.equal((await request('PUT', '/push/devices/browser-a', { token: 'token-a' })).status, 200);
  assert.equal((await request('PUT', '/push/devices/browser-b', { token: 'token-b' })).status, 200);
  assert.equal((await f.devices.targets(['alice'])).length, 2);
  assert.equal((await request('PUT', '/push/devices/browser-c', { token: 'token-a' })).status, 200);
  assert.equal((await f.devices.targets(['alice'])).length, 2);
  assert.equal(
    (await request('DELETE', '/push/devices/browser-c', undefined, 'id-bob')).status,
    200,
  );
  assert.equal((await f.devices.targets(['alice'])).length, 2);
  assert.equal(
    (await request('PUT', '/push/devices/browser-c', { token: 'token-a' }, 'id-bob')).status,
    200,
  );
  assert.deepEqual(
    (await f.devices.targets(['alice'])).map((device) => device.token),
    ['token-b'],
  );
  assert.deepEqual(
    (await f.devices.targets(['bob'])).map((device) => device.token),
    ['token-a'],
  );
  assert.equal(
    (await request('PUT', '/push/devices/browser-c', { token: 'rotated-token' }, 'id-bob')).status,
    200,
  );
  assert.deepEqual(
    (await f.devices.targets(['bob'])).map((device) => device.token),
    ['rotated-token'],
  );
  assert.equal(
    (await request('PUT', '/push/devices/browser-c', { token: 'attacker-token' })).status,
    403,
  );
  assert.equal(
    (await request('DELETE', '/push/devices/browser-c', undefined, 'id-bob')).status,
    200,
  );
  assert.equal((await f.devices.targets(['bob'])).length, 0);
  assert.equal(
    (await request('DELETE', '/push/devices/browser-c', undefined, 'id-bob')).status,
    200,
  );
});

test('concurrent registration and account transfer keep one owner per token', async () => {
  const f = fixture();
  await Promise.all([
    f.devices.register('alice', 'browser-a', 'shared-token'),
    f.devices.register('bob', 'browser-b', 'shared-token'),
    f.devices.register('carol', 'browser-c', 'shared-token'),
  ]);
  assert.equal((await f.devices.targets(['alice', 'bob', 'carol'])).length, 1);
  assert.equal(Object.keys(f.db.read('_server/pushRegistry/tokens')).length, 1);
});

test('only confirmed invalid/unregistered tokens are removed; transient/config errors survive', async () => {
  const codes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/server-unavailable',
    'messaging/mismatched-credential',
    'messaging/invalid-argument',
  ];
  const f = fixture({
    send: async () => ({
      successCount: 0,
      failureCount: codes.length,
      responses: codes.map((code) => ({ success: false, error: { code } })),
    }),
  });
  for (let index = 0; index < codes.length; index++)
    await f.devices.register('bob', `device-${index}`, `token-${index}`);
  await f.push.notify({
    conversationId: 'room',
    messageId: 'm',
    senderId: 'alice',
    recipientIds: ['alice', 'bob'],
  });
  assert.deepEqual((await f.devices.targets(['bob'])).map((device) => device.token).sort(), [
    'token-2',
    'token-3',
    'token-4',
  ]);
});

test('late invalid-token response cannot remove a refreshed or transferred registration', async () => {
  const f = fixture();
  await f.devices.register('alice', 'browser', 'token');
  const [old] = await f.devices.targets(['alice']);
  await f.devices.register('bob', 'browser', 'token');
  await f.devices.removeInvalid(old);
  assert.equal((await f.devices.targets(['bob'])).length, 1);
});

test('registration moved before dispatch is not sent to the previous account', async () => {
  const f = fixture();
  await f.devices.register('bob', 'browser', 'token');
  const original = f.devices.targets.bind(f.devices);
  let calls = 0;
  f.devices.targets = async (uids) => {
    const targets = await original(uids);
    if (++calls === 1) await f.devices.register('carol', 'browser', 'token');
    return targets;
  };
  await f.push.notify({
    conversationId: 'room',
    messageId: 'm',
    senderId: 'alice',
    recipientIds: ['bob'],
  });
  assert.equal(f.sender.calls.length, 0);
});

test('safe link uses real frontend root route and a configured HTTPS origin', () => {
  assert.equal(
    conversationLink('https://chat.example.com', 'direct_a_b'),
    'https://chat.example.com/?conversationId=direct_a_b',
  );
  for (const url of [
    'http://chat.example.com',
    'https://evil@example.com',
    'https://chat.example.com/path',
    'https://chat.example.com/?url=evil',
  ]) {
    assert.throws(() => conversationLink(url, 'room'));
  }
});

test('FCM batches are capped at 500 tokens', async () => {
  const f = fixture();
  const devices = {};
  for (let index = 0; index < 501; index++)
    devices[`device-${index}`] = {
      ownerUid: 'bob',
      token: `token-${index}`,
      tokenHash: `hash-${index}`,
      version: `v-${index}`,
    };
  f.db.write('_server/pushRegistry', { devices });
  await f.push.notify({
    conversationId: 'room',
    messageId: 'm',
    senderId: 'alice',
    recipientIds: ['bob', 'bob'],
  });
  assert.deepEqual(
    f.sender.calls.map((call) => call.tokens.length),
    [500, 1],
  );
});

test('one failed token cleanup does not prevent handling other token results', async () => {
  const f = fixture({
    send: async () => ({
      successCount: 0,
      failureCount: 2,
      responses: [0, 1].map(() => ({
        success: false,
        error: { code: 'messaging/registration-token-not-registered' },
      })),
    }),
  });
  await f.devices.register('bob', 'first', 'first-token');
  await f.devices.register('bob', 'second', 'second-token');
  const original = f.devices.removeInvalid.bind(f.devices);
  f.devices.removeInvalid = async (target) => {
    if (target.deviceId === 'first') throw new Error('Simulated database cleanup failure');
    return original(target);
  };
  await f.push.notify({
    conversationId: 'room',
    messageId: 'm',
    senderId: 'alice',
    recipientIds: ['bob'],
  });
  assert.deepEqual(
    (await f.devices.targets(['bob'])).map((target) => target.deviceId),
    ['first'],
  );
});

test('invalid registration-token validation does not echo its full value', async (t) => {
  const f = fixture();
  const request = await api(t, f);
  const token = 'sensitive registration token with spaces';
  const response = await request('PUT', '/push/devices/browser', { token });
  assert.equal(response.status, 422);
  assert.ok(!JSON.stringify(response.body).includes(token));
  assert.equal(f.db.read('_server/pushRegistry'), null);
});
