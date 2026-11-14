const { setImmediate: immediate } = require('node:timers/promises');
const express = require('express');
const { once } = require('node:events');
const { ChatRepository } = require('../dist/repositories/chat.repository');
const { PushDeviceRepository } = require('../dist/repositories/push-device.repository');
const { ChatService } = require('../dist/services/chat.service');
const { PushService } = require('../dist/services/push.service');
const { createChatRouter } = require('../dist/routes/v1/chat');
const { errorHandler, notFoundErrorHandler } = require('../dist/middlewares/error');

const clone = (value) => structuredClone(value);
const snapshot = (value) => {
  const saved = clone(value);
  return { val: () => clone(saved) };
};
function resolveTimestamps(value, timestamp = Date.now()) {
  if (!value || typeof value !== 'object') return value;
  if (value['.sv'] === 'timestamp') return timestamp;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, resolveTimestamps(child, timestamp)]),
  );
}

// Optimistic CAS mock: concurrent writers read the same revision, then losers retry.
// It also exercises the Admin SDK's initial empty-cache transaction callback.
class MemoryDatabase {
  constructor(data = {}) {
    this.data = clone(data);
    this.revision = 0;
    this.failWrites = false;
  }
  read(path) {
    return (
      path
        .split('/')
        .filter(Boolean)
        .reduce((value, key) => value?.[key], this.data) ?? null
    );
  }
  write(path, value) {
    const parts = path.split('/').filter(Boolean);
    let parent = this.data;
    for (const key of parts.slice(0, -1)) parent = parent[key] ||= {};
    parent[parts.at(-1)] = resolveTimestamps(clone(value));
    this.revision++;
  }
  ref(path) {
    return {
      get: async () => snapshot(this.read(path)),
      transaction: async (update) => {
        if (this.failWrites) throw new Error('Simulated RTDB write failure');
        update(null);
        for (let attempt = 0; attempt < 100; attempt++) {
          const revision = this.revision;
          const current = clone(this.read(path));
          const next = update(current);
          if (next === undefined) return { committed: false, snapshot: snapshot(current) };
          await immediate();
          if (revision !== this.revision) continue;
          this.write(path, next);
          return { committed: true, snapshot: snapshot(this.read(path)) };
        }
        throw new Error('CAS retry limit');
      },
    };
  }
}

const room = () => ({
  info: {
    title: 'Example',
    memberIds: { alice: true, bob: true, carol: true, removed: false },
    members: { alice: 'Alice', bob: 'Bob', carol: 'Carol' },
    memberSlots: { 0: 'alice', 1: 'bob', 2: 'carol' },
    createdBy: 'alice',
    createdAt: 1000,
    updatedAt: 1000,
    lastMessage: '',
    lastMessageId: '',
    lastSenderId: '',
    customMetadata: 'preserve',
  },
  unrelated: { keep: true },
});

function fixture(options = {}) {
  const db = new MemoryDatabase({ rooms: { room: room() } });
  const devices = new PushDeviceRepository(() => db);
  const sender = {
    calls: [],
    async sendEachForMulticast(payload) {
      this.calls.push(payload);
      if (options.send) return options.send(payload);
      return {
        successCount: payload.tokens.length,
        failureCount: 0,
        responses: payload.tokens.map(() => ({ success: true, messageId: 'fcm-test' })),
      };
    },
  };
  const push = new PushService(devices, () => sender, {
    baseUrl: 'https://chat.example.com',
    timeoutMs: options.timeoutMs || 100,
  });
  const repository = new ChatRepository(() => db);
  const chat = new ChatService(repository, push);
  return { db, devices, sender, push, repository, chat };
}

async function api(t, dependencies) {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1',
    createChatRouter({
      chat: dependencies.chat,
      devices: dependencies.devices,
      verifyToken: async (token) => {
        const uid = { 'id-alice': 'alice', 'id-bob': 'bob', 'id-outsider': 'outsider' }[token];
        if (!uid) throw new Error('Invalid test ID token');
        return { uid };
      },
    }),
  );
  app.use(notFoundErrorHandler);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  return async (method, path, body, token = 'id-alice') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: await response.json() };
  };
}

module.exports = { MemoryDatabase, fixture, api };
