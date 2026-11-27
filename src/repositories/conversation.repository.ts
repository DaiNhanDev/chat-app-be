import { createHash, randomUUID } from 'node:crypto';
import { Database, ServerValue } from 'firebase-admin/database';
import { firebaseRoomIds } from 'src/configs/firebase.config';
import { ChatActor, Conversation, ConversationInfo } from 'src/types/chat-account';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { ConflictRequestError, NotFoundError } from 'src/utils/error.response';
import { isFirebaseKey } from 'src/utils/firebase-key';
import { roomReadSummary } from 'src/utils/chat-read-state';

interface RoomMembership {
  memberIds: Record<string, boolean>;
  ownerAccountId?: string;
}

interface RoomState {
  info?: ConversationInfo;
  reservation?: RoomMembership;
  [field: string]: unknown;
}

const memberIds = (info: RoomMembership): string[] =>
  Object.entries(info.memberIds || {})
    .filter(([, active]) => active === true)
    .map(([uid]) => uid)
    .sort();

const sameMembers = (info: RoomMembership, expected: string[]): boolean =>
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

  async create(
    admin: ChatActor,
    user: ChatActor,
    canCreate: () => Promise<boolean>,
  ): Promise<Conversation> {
    const db = this.database();
    const participants = [admin, user];
    const ids = participants.map((member) => member.uid).sort();
    const conflict = () =>
      new ConflictRequestError(
        ERROR_MESSAGE.USER_ROOM_ALREADY_ASSIGNED,
        'User already belongs to another room',
      );
    // Preserve existing rooms, including the former deterministic ID when its index is missing.
    const existing = await this.list(user.uid);
    if (existing.length > 1) throw conflict();
    const legacyId = 'user_' + createHash('sha256').update(user.accountId).digest('hex');
    const existingId = existing[0]?.id ?? legacyId;
    const existingInfo = (
      await db.ref(`rooms/${existingId}/info`).get()
    ).val() as ConversationInfo | null;
    if (existingInfo) {
      if (!sameMembers(existingInfo, ids)) throw conflict();
      await this.index(existingId, ids);
      const info = (
        await db.ref(`rooms/${existingId}/info`).get()
      ).val() as ConversationInfo | null;
      if (!info) await this.removeIndexes(existingId, ids);
      if (!info || !(await canCreate())) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
      if (!sameMembers(info, ids)) throw conflict();
      return toConversation(existingId, info, admin.uid);
    }

    // A fresh ID per lifetime lets a surviving USER get a new room without a late delete
    // on the old room interfering with the replacement. Every ADMIN still shares one slot.
    const slot = this.slot(user.accountId);
    const next = 'user_' + randomUUID();
    const assigned = await slot.transaction((current: string | null) => current ?? next);
    const id: unknown = assigned.snapshot.val();
    if (!isFirebaseKey(id)) throw new Error('Invalid stored room ID');
    const roomRef = db.ref(`rooms/${id}`);
    const membership = {
      ownerAccountId: user.accountId,
      memberIds: Object.fromEntries(ids.map((uid) => [uid, true])),
    };
    const reserved = await roomRef.transaction(
      (room: RoomState | null) =>
        room?.info || room?.reservation ? undefined : { ...room, reservation: membership },
      undefined,
      false,
    );
    const current = reserved.snapshot.val() as RoomState | null;
    const candidate = current?.info ?? current?.reservation;
    if (!candidate || !sameMembers(candidate, ids)) throw conflict();
    await this.index(id, ids);

    // Deletion disables the Mongo account before sweeping these indexes. Once this check
    // passes, a concurrent delete can remove the reservation that finalization requires.
    if (!(await canCreate()) || (await slot.get()).val() !== id) {
      const discarded = await roomRef.transaction((room: RoomState | null) => {
        if (room === null) return null;
        return room.reservation && !room.info && sameMembers(room.reservation, ids)
          ? null
          : undefined;
      });
      if (!discarded.snapshot.exists()) {
        await this.clearSlot(user.accountId, id);
        await this.removeIndexes(id, ids);
      }
      throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    }

    const info = {
      ...membership,
      title: '',
      members: Object.fromEntries(participants.map((member) => [member.uid, member.displayName])),
      memberSlots: Object.fromEntries(ids.map((uid, slot) => [slot, uid])),
      createdBy: admin.uid,
      createdAt: ServerValue.TIMESTAMP,
      updatedAt: ServerValue.TIMESTAMP,
      lastMessage: '',
      lastMessageId: '',
      lastSenderId: '',
    };
    const saved = await roomRef.transaction(
      (room: RoomState | null) => {
        // Null may be an empty local cache. This no-op also keeps deleted rooms absent.
        if (room === null) return null;
        if (room.info || !room.reservation || !sameMembers(room.reservation, ids)) return undefined;
        const { reservation: _reservation, ...rest } = room;
        return { ...rest, info };
      },
      undefined,
      false,
    );
    const result = (saved.snapshot.val() as RoomState | null)?.info;
    if (!result) {
      await this.removeIndexes(id, ids);
      throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    }
    if (!sameMembers(result, ids)) throw conflict();
    return toConversation(id, result, admin.uid);
  }

  async deleteForAccount(actor: ChatActor): Promise<void> {
    const db = this.database();
    const { uid, accountId } = actor;
    const rooms = db.ref('rooms');
    const index = db.ref(`userConversations/${uid}`);
    const [indexed, ownSlot, roomIds] = await Promise.all([
      index.get(),
      this.slot(accountId).get(),
      firebaseRoomIds(db),
    ]);
    const ids = new Set<string>(roomIds.filter(isFirebaseKey));
    const indexedIds = new Set<string>();
    indexed.forEach((child) => {
      if (isFirebaseKey(child.key)) {
        ids.add(child.key);
        indexedIds.add(child.key);
      }
    });
    const assigned = ownSlot.val();
    if (isFirebaseKey(assigned)) ids.add(assigned);
    const candidates = [...ids];
    for (let offset = 0; offset < candidates.length; offset += 25) {
      await Promise.all(
        candidates.slice(offset, offset + 25).map(async (id) => {
          // Read the reservation first. If it was promoted, the following read sees info.
          const reservation = (
            await rooms.child(`${id}/reservation`).get()
          ).val() as RoomMembership | null;
          const link =
            reservation ?? ((await rooms.child(`${id}/info`).get()).val() as RoomMembership | null);
          const members = link ? memberIds(link) : [];
          if (!members.includes(uid)) {
            if (indexedIds.has(id)) await index.child(id).remove();
            return;
          }
          if (link?.ownerAccountId) await this.clearSlot(link.ownerAccountId, id);
          await db.ref().update({
            [`rooms/${id}`]: null,
            ...Object.fromEntries(
              members.map((member): [string, null] => [`userConversations/${member}/${id}`, null]),
            ),
          });
        }),
      );
    }
    if (isFirebaseKey(assigned)) await this.clearSlot(accountId, assigned);
  }

  private slot(accountId: string) {
    return this.database().ref(`_server/userRooms/${accountId}`);
  }

  private async clearSlot(accountId: string, id: string): Promise<void> {
    await this.slot(accountId).transaction((current: string | null) =>
      current === id ? null : current === null ? null : undefined,
    );
  }

  private async removeIndexes(id: string, members: string[]): Promise<void> {
    await this.database()
      .ref()
      .update(
        Object.fromEntries(
          members.map((uid): [string, null] => [`userConversations/${uid}/${id}`, null]),
        ),
      );
  }

  private async index(roomId: string, ids: string[]): Promise<void> {
    await this.database()
      .ref()
      .update(Object.fromEntries(ids.map((uid) => [`userConversations/${uid}/${roomId}`, true])));
  }
}
