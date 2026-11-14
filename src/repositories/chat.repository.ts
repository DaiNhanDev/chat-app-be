import { Database, ServerValue } from 'firebase-admin/database';
import { ChatRoom, SavedMessage, SendMessageInput } from 'src/types/chat';
import { ConflictRequestError, ForbiddenError, NotFoundError } from 'src/utils/error.response';
import { ERROR_MESSAGE } from 'src/constants/error.message';

const isMember = (room: ChatRoom | null, uid: string): boolean =>
  !!room?.info &&
  Object.prototype.hasOwnProperty.call(room.info.memberIds || {}, uid) &&
  room.info.memberIds[uid] === true;

const checkMembership = (room: ChatRoom | null, uid: string) => {
  if (!room?.info) throw new NotFoundError();
  if (!isMember(room, uid)) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
};

export class ChatRepository {
  constructor(private readonly database: () => Database) {}

  async save(conversationId: string, uid: string, input: SendMessageInput): Promise<SavedMessage> {
    const roomRef = this.database().ref(`rooms/${conversationId}`);
    checkMembership((await roomRef.get()).val(), uid);

    // A single CAS covers membership, deduplication, the message and all preview fields.
    // Plain multi-location update() cannot conditionally insert an idempotency key.
    const result = await roomRef.transaction(
      (current: ChatRoom | null) => {
        // Firebase can initially invoke this callback with an empty local cache.
        if (current === null) return null;
        // Never throw in an SDK retry callback; abort and classify the final snapshot below.
        if (!isMember(current, uid)) return undefined;
        if (current.messages?.[input.clientMessageId]) return undefined;
        return {
          ...current,
          messages: {
            ...current.messages,
            [input.clientMessageId]: {
              senderId: uid,
              text: input.text,
              createdAt: ServerValue.TIMESTAMP,
            },
          },
          info: {
            ...current.info,
            lastMessage: input.text,
            lastMessageId: input.clientMessageId,
            lastSenderId: uid,
            updatedAt: ServerValue.TIMESTAMP,
          },
        };
      },
      undefined,
      false,
    );
    const room: ChatRoom = result.snapshot.val();
    checkMembership(room, uid);
    const message = room.messages?.[input.clientMessageId];
    if (message && (message.senderId !== uid || message.text !== input.text)) {
      throw new ConflictRequestError(
        ERROR_MESSAGE.IDEMPOTENCY_CONFLICT,
        'clientMessageId has already been used for another message',
      );
    }
    if (!message || typeof message.createdAt !== 'number') {
      throw new Error('Message transaction did not return a committed message');
    }
    return {
      message: { id: input.clientMessageId, ...message },
      duplicate: !result.committed,
      recipientIds: Object.entries(room.info.memberIds)
        .filter(([memberId, active]) => active === true && memberId !== uid)
        .map(([memberId]) => memberId),
    };
  }
}
