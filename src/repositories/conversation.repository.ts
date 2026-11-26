import { createHash } from 'node:crypto';
import { Database, ServerValue } from 'firebase-admin/database';
import { ChatActor, Conversation, ConversationInfo } from 'src/types/chat-account';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { ConflictRequestError } from 'src/utils/error.response';
import { isFirebaseKey } from 'src/utils/firebase-key';
import { roomReadSummary } from 'src/utils/chat-read-state';

const memberIds = (info: ConversationInfo): string[] =>
  Object.entries(info.memberIds || {})
    .filter(([, active]) => active === true)
    .map(([uid]) => uid)
    .sort();

const sameMembers = (info: ConversationInfo, expected: string[]): boolean =>
  memberIds(info).join('\0') === expected.join('\0');

const toConversation = (id: string, info: ConversationInfo, uid: string): Conversation => ({
  id,
  title: info.title,
  memberIds: memberIds(info),
  members: info.members,
  createdBy: info.createdBy,
  createdAt: info.createdAt,
  updatedAt: info.updatedAt,
  lastMessage: info.lastMessage,
  lastMessageId: info.lastMessageId,
  lastSenderId: info.lastSenderId,
  ...roomReadSummary(info, uid),
});

export class ConversationRepository {
  constructor(private readonly database: () => Database) {}

  async list(uid: string): Promise<Conversation[]> {
    const db = this.database();
    const index = (await db.ref(`userConversations/${uid}`).get()).val() as Record<
      string,
      boolean
    > | null;
    const ids = Object.entries(index || {})
      .filter(([id, active]) => active === true && isFirebaseKey(id))
      .map(([id]) => id);
    const entries = await Promise.all(
      ids.map(async (id) => {
        const info = (await db.ref(`rooms/${id}/info`).get()).val() as ConversationInfo | null;
        if (
          !info?.memberIds ||
          !Object.prototype.hasOwnProperty.call(info.memberIds, uid) ||
          info.memberIds[uid] !== true
        )
          return null;
        return toConversation(id, info, uid);
      }),
    );
    return entries
      .filter((entry): entry is Conversation => entry !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id));
  }

  async create(admin: ChatActor, user: ChatActor): Promise<Conversation> {
    const db = this.database();
    const participants = [admin, user];
    const ids = participants.map((member) => member.uid).sort();
    const conflict = () =>
      new ConflictRequestError(
        ERROR_MESSAGE.USER_ROOM_ALREADY_ASSIGNED,
        'User already belongs to another room',
      );
    // Reuse indexed legacy rooms and preserve their original ids and history.
    const existing = await this.list(user.uid);
    if (existing.length) {
      const room = existing[0]!;
      if (existing.length !== 1 || room.memberIds.join('\0') !== ids.join('\0')) throw conflict();
      await this.index(room.id, ids);
      const info = (await db.ref(`rooms/${room.id}/info`).get()).val() as ConversationInfo | null;
      if (!info || !sameMembers(info, ids)) throw conflict();
      return toConversation(room.id, info, admin.uid);
    }
    // Every admin competes for the same room key for this Mongo account.
    const id = 'user_' + createHash('sha256').update(user.accountId).digest('hex');
    const infoRef = db.ref(`rooms/${id}/info`);
    const info = {
      title: '',
      memberIds: Object.fromEntries(ids.map((uid) => [uid, true])),
      members: Object.fromEntries(participants.map((member) => [member.uid, member.displayName])),
      memberSlots: Object.fromEntries(ids.map((uid, slot) => [slot, uid])),
      createdBy: admin.uid,
      createdAt: ServerValue.TIMESTAMP,
      updatedAt: ServerValue.TIMESTAMP,
      lastMessage: '',
      lastMessageId: '',
      lastSenderId: '',
    };
    const saved = await infoRef.transaction(
      (current: ConversationInfo | null) => (current === null ? info : undefined),
      undefined,
      false,
    );
    const result = saved.snapshot.val() as ConversationInfo | null;
    if (!result || !sameMembers(result, ids)) throw conflict();
    // Only add indexes after create-if-absent. Retrying repairs a failed index write;
    // it never resets an existing room's messages, title, creator or preview.
    await this.index(id, ids);
    return toConversation(id, result, admin.uid);
  }

  private async index(roomId: string, ids: string[]): Promise<void> {
    await this.database()
      .ref()
      .update(Object.fromEntries(ids.map((uid) => [`userConversations/${uid}/${roomId}`, true])));
  }
}
