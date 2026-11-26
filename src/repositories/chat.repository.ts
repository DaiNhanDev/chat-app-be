import { Database, ServerValue } from 'firebase-admin/database';
import { ChatRoom, SavedMessage, SendMessageInput, StoredMessage } from 'src/types/chat';
import { ConflictRequestError, ForbiddenError, NotFoundError } from 'src/utils/error.response';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { roomReadSummary } from 'src/utils/chat-read-state';

const entry = <T>(items: Record<string, T> | undefined, id: string): T | undefined =>
  items && Object.prototype.hasOwnProperty.call(items, id) ? items[id] : undefined;

const isMember = (room: ChatRoom | null, uid: string): boolean =>
  entry(room?.info?.memberIds, uid) === true;

const recipients = (room: ChatRoom, uid: string): string[] =>
  Object.entries(room.info.memberIds)
    .filter(([memberId, active]) => active === true && memberId !== uid)
    .map(([memberId]) => memberId);

const checkMembership = (room: ChatRoom | null, uid: string) => {
  if (!room?.info) throw new NotFoundError();
  if (!isMember(room, uid)) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
};

function latestMessage(messages: Record<string, StoredMessage>) {
  let latest: { id: string; message: StoredMessage } | undefined;
  for (const [id, message] of Object.entries(messages)) {
    if (
      !latest ||
      message.createdAt > latest.message.createdAt ||
      (message.createdAt === latest.message.createdAt && id > latest.id)
    ) {
      latest = { id, message };
    }
  }
  return latest;
}

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
        if (
          entry(current.messages, input.clientMessageId) ||
          entry(current.deletedMessages, input.clientMessageId)
        )
          return undefined;
        const sequence = (current.info.messageSequence ?? 0) + 1;
        const readState = { ...current.info.readState };
        for (const recipient of recipients(current, uid)) {
          const previous = entry(readState, recipient);
          readState[recipient] = {
            through: previous?.through ?? 0,
            unreadCount: (previous?.unreadCount ?? 0) + 1,
          };
        }
        return {
          ...current,
          messages: {
            ...current.messages,
            [input.clientMessageId]: {
              senderId: uid,
              text: input.text,
              createdAt: ServerValue.TIMESTAMP,
              sequence,
            },
          },
          info: {
            ...current.info,
            lastMessage: input.text,
            lastMessageId: input.clientMessageId,
            lastSenderId: uid,
            updatedAt: ServerValue.TIMESTAMP,
            messageSequence: sequence,
            readState,
            unreadRevision: (current.info.unreadRevision ?? 0) + 1,
          },
        };
      },
      undefined,
      false,
    );
    const room: ChatRoom = result.snapshot.val();
    checkMembership(room, uid);
    if (entry(room.deletedMessages, input.clientMessageId)) {
      throw new ConflictRequestError(
        ERROR_MESSAGE.MESSAGE_DELETED,
        'clientMessageId belongs to a deleted message',
      );
    }
    const message = entry(room.messages, input.clientMessageId);
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
      recipientIds: recipients(room, uid),
    };
  }

  async deleteMessage(conversationId: string, uid: string, messageId: string): Promise<void> {
    const roomRef = this.database().ref(`rooms/${conversationId}`);
    checkMembership((await roomRef.get()).val(), uid);

    const result = await roomRef.transaction(
      (current: ChatRoom | null) => {
        if (current === null) return null;
        const message = entry(current.messages, messageId);
        if (!isMember(current, uid) || message?.senderId !== uid) {
          return undefined;
        }
        const messages = { ...current.messages };
        delete messages[messageId];

        const info = { ...current.info };
        const readState = { ...info.readState };
        for (const recipient of recipients(current, uid)) {
          const state = entry(readState, recipient);
          if (state && (message.sequence ?? 0) > state.through) {
            readState[recipient] = {
              ...state,
              unreadCount: Math.max(0, state.unreadCount - 1),
            };
          }
        }
        if (typeof info.lastMessageId !== 'string' || !entry(messages, info.lastMessageId)) {
          const latest = latestMessage(messages);
          info.lastMessage = latest?.message.text ?? '';
          info.lastMessageId = latest?.id ?? '';
          info.lastSenderId = latest?.message.senderId ?? '';
          info.updatedAt = ServerValue.TIMESTAMP;
        }

        return {
          ...current,
          info: { ...info, readState, unreadRevision: (info.unreadRevision ?? 0) + 1 },
          messages,
          // Keep the owner only, so a retried send cannot recreate the deleted message.
          deletedMessages: { ...current.deletedMessages, [messageId]: uid },
        };
      },
      undefined,
      false,
    );
    const room: ChatRoom = result.snapshot.val();
    checkMembership(room, uid);
    const deletedBy = entry(room.deletedMessages, messageId);
    const owner = deletedBy ?? entry(room.messages, messageId)?.senderId;
    if (owner === undefined)
      throw new NotFoundError(ERROR_MESSAGE.MESSAGE_NOT_FOUND, 'Message not found');
    if (owner !== uid) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
    if (deletedBy !== uid) throw new Error('Message deletion did not commit');
  }

  async markRead(conversationId: string, uid: string, messageId: string) {
    const roomRef = this.database().ref(`rooms/${conversationId}`);
    checkMembership((await roomRef.get()).val(), uid);
    const result = await roomRef.transaction(
      (current: ChatRoom | null) => {
        if (current === null) return null;
        if (!isMember(current, uid)) return undefined;
        const message = entry(current.messages, messageId);
        const through = message?.sequence ?? 0;
        if (!message || through <= (entry(current.info.readState, uid)?.through ?? 0))
          return undefined;

        const unreadCount = Object.values(current.messages || {}).filter(
          (item) => item.senderId !== uid && (item.sequence ?? 0) > through,
        ).length;
        return {
          ...current,
          info: {
            ...current.info,
            readState: { ...current.info.readState, [uid]: { through, unreadCount } },
            unreadRevision: (current.info.unreadRevision ?? 0) + 1,
          },
        };
      },
      undefined,
      false,
    );
    const room: ChatRoom = result.snapshot.val();
    checkMembership(room, uid);
    if (!entry(room.messages, messageId))
      throw new NotFoundError(ERROR_MESSAGE.MESSAGE_NOT_FOUND, 'Message not found');
    return { conversationId, ...roomReadSummary(room.info, uid) };
  }
}
