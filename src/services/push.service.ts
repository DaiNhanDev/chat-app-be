import { BatchResponse, MulticastMessage } from 'firebase-admin/messaging';
import { PushDeviceRepository } from 'src/repositories/push-device.repository';
import { PushContext } from 'src/types/push';
import { logger } from 'src/utils/logger';

export interface PushSender {
  sendEachForMulticast(message: MulticastMessage): Promise<BatchResponse>;
}

export interface PushOptions {
  baseUrl: string;
  timeoutMs: number;
}

const invalidTokenCodes = new Set([
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
]);

export const conversationLink = (baseUrl: string, conversationId: string): string => {
  const base = new URL(baseUrl);
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.pathname !== '/' ||
    base.search ||
    base.hash
  ) {
    throw new Error('PWA_BASE_URL must be an HTTPS origin');
  }
  // The actual frontend route is /. The FE must consume this query to select the room.
  base.searchParams.set('conversationId', conversationId);
  return base.toString();
};

export class PushService {
  private readonly pending = new Set<Promise<void>>();

  constructor(
    private readonly devices: Pick<PushDeviceRepository, 'targets' | 'removeInvalid'>,
    private readonly sender: () => PushSender,
    private readonly options: PushOptions,
  ) {}

  async notify(context: PushContext): Promise<void> {
    if (this.pending.size >= 100) {
      logger.warn('Push skipped: too many pending operations', { messageId: context.messageId });
      return;
    }
    const deadline = new AbortController();
    const operation = this.deliver(context, deadline.signal).catch(() => {
      // SDK errors can contain tokens. Never log the raw error, message or request payload.
      logger.error('Push delivery failed', {
        conversationId: context.conversationId,
        messageId: context.messageId,
      });
    });
    this.pending.add(operation);
    void operation.then(() => this.pending.delete(operation));
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        deadline.abort();
        logger.warn('Push deadline exceeded; delivery outcome is unknown', {
          messageId: context.messageId,
          timeoutMs: this.options.timeoutMs,
        });
        resolve();
      }, this.options.timeoutMs);
    });
    try {
      await Promise.race([operation, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }

  private async deliver(context: PushContext, signal: AbortSignal): Promise<void> {
    const link = conversationLink(this.options.baseUrl, context.conversationId);
    const recipients = [...new Set(context.recipientIds.filter((uid) => uid !== context.senderId))];
    if (!recipients.length) return;
    const candidates = await this.devices.targets(recipients);
    if (signal.aborted) return;
    for (let offset = 0; offset < candidates.length; offset += 500) {
      // Recheck ownership near dispatch, especially after account switching.
      const latest = new Map(
        (await this.devices.targets(recipients)).map((device) => [device.deviceId, device]),
      );
      const batch = candidates
        .slice(offset, offset + 500)
        .filter((device) => latest.get(device.deviceId)?.version === device.version);
      if (signal.aborted) return;
      if (!batch.length) continue;
      const result = await this.sender().sendEachForMulticast({
        tokens: batch.map((device) => device.token),
        notification: { title: 'Chat', body: 'Bạn có tin nhắn mới' },
        data: { conversationId: context.conversationId, messageId: context.messageId },
        webpush: {
          fcmOptions: { link },
          notification: { tag: `chat-${context.conversationId}` },
        },
      });
      for (let index = 0; index < result.responses.length; index++) {
        const response = result.responses[index];
        const device = batch[index];
        if (!response || !device || response.success) continue;
        const code = response.error?.code || 'unknown';
        logger.warn('Push failed for device', {
          deviceId: device.deviceId,
          errorCode: /^messaging\/[a-z-]+$/.test(code) ? code : 'unknown',
          invalidRegistration: invalidTokenCodes.has(code),
          messageId: context.messageId,
        });
        if (invalidTokenCodes.has(code) && !signal.aborted) {
          try {
            await this.devices.removeInvalid(device);
          } catch {
            logger.error('Invalid push registration cleanup failed', { deviceId: device.deviceId });
          }
        }
      }
      logger.info('Push batch completed', {
        messageId: context.messageId,
        successCount: result.successCount,
        failureCount: result.failureCount,
      });
      if (signal.aborted) return;
    }
  }

  async drain(timeoutMs: number): Promise<void> {
    let timer: ReturnType<typeof setTimeout>;
    try {
      await Promise.race([
        Promise.allSettled([...this.pending]),
        new Promise<void>((resolve) => {
          timer = setTimeout(resolve, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(timer!);
    }
    if (this.pending.size)
      logger.warn('Shutdown left unfinished push operations', { count: this.pending.size });
  }
}
