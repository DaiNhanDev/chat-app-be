import { createHash, randomUUID } from 'node:crypto';
import { Database } from 'firebase-admin/database';
import { PushRegistry, PushTarget } from 'src/types/push';
import { ForbiddenError } from 'src/utils/error.response';

const REGISTRY_PATH = '_server/pushRegistry';

export class PushDeviceRepository {
  constructor(private readonly database: () => Database) {}

  async register(uid: string, deviceId: string, token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const version = randomUUID();
    const result = await this.database()
      .ref(REGISTRY_PATH)
      .transaction((current: PushRegistry | null) => {
        const devices = { ...current?.devices };
        const tokens = { ...current?.tokens };
        const oldDevice = devices[deviceId];
        // Account switching on the same browser is proved by possession of its token.
        if (oldDevice && oldDevice.ownerUid !== uid && oldDevice.tokenHash !== tokenHash) {
          return undefined;
        }
        if (oldDevice && tokens[oldDevice.tokenHash] === deviceId)
          delete tokens[oldDevice.tokenHash];
        const previousDeviceId = tokens[tokenHash];
        if (previousDeviceId) delete devices[previousDeviceId];
        devices[deviceId] = { ownerUid: uid, token, tokenHash, version };
        tokens[tokenHash] = deviceId;
        return { devices, tokens };
      });
    if (!result.committed) throw new ForbiddenError();
  }

  async unregister(uid: string, deviceId: string): Promise<void> {
    await this.database()
      .ref(REGISTRY_PATH)
      .transaction((current: PushRegistry | null) => {
        if (current === null) return null;
        const device = current.devices?.[deviceId];
        if (!device || device.ownerUid !== uid) return undefined;
        const devices = { ...current.devices };
        const tokens = { ...current.tokens };
        delete devices[deviceId];
        if (tokens[device.tokenHash] === deviceId) delete tokens[device.tokenHash];
        return { devices, tokens };
      });
  }

  async targets(recipientIds: string[]): Promise<PushTarget[]> {
    const registry: PushRegistry | null = (await this.database().ref(REGISTRY_PATH).get()).val();
    const recipients = new Set(recipientIds);
    const seen = new Set<string>();
    return Object.entries(registry?.devices || {}).flatMap(([deviceId, device]) => {
      if (!recipients.has(device.ownerUid) || seen.has(device.tokenHash)) return [];
      seen.add(device.tokenHash);
      return [{ deviceId, ...device }];
    });
  }

  async removeInvalid(target: PushTarget): Promise<void> {
    await this.database()
      .ref(REGISTRY_PATH)
      .transaction((current: PushRegistry | null) => {
        if (current === null) return null;
        const currentDevice = current.devices?.[target.deviceId];
        // A delayed FCM result must not delete a refreshed/transferred registration.
        if (currentDevice?.version !== target.version) return undefined;
        const devices = { ...current.devices };
        const tokens = { ...current.tokens };
        delete devices[target.deviceId];
        if (tokens[target.tokenHash] === target.deviceId) delete tokens[target.tokenHash];
        return { devices, tokens };
      });
  }
}
