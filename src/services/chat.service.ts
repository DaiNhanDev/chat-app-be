import { ChatRepository } from 'src/repositories/chat.repository';
import { PushService } from 'src/services/push.service';
import { SendMessageInput } from 'src/types/chat';
import { logger } from 'src/utils/logger';

export class ChatService {
  constructor(
    private readonly repository: Pick<ChatRepository, 'save' | 'deleteMessage' | 'markRead'>,
    private readonly push: Pick<PushService, 'notify'>,
  ) {}

  async send(conversationId: string, uid: string, input: SendMessageInput) {
    const saved = await this.repository.save(conversationId, uid, input);
    if (!saved.duplicate) {
      try {
        await this.push.notify({
          conversationId,
          messageId: saved.message.id,
          senderId: uid,
          recipientIds: saved.recipientIds,
        });
      } catch {
        logger.error('Push failed after message commit', {
          conversationId,
          messageId: saved.message.id,
        });
      }
    }
    return { message: saved.message, duplicate: saved.duplicate };
  }

  async deleteMessage(conversationId: string, uid: string, messageId: string) {
    await this.repository.deleteMessage(conversationId, uid, messageId);
    return { messageId, deleted: true };
  }

  markRead(conversationId: string, uid: string, messageId: string) {
    return this.repository.markRead(conversationId, uid, messageId);
  }
}
