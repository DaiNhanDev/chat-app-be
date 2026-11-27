import { UserModel } from 'src/models';
import { isRole, ROLE, RoleType } from 'src/constants';
import { User } from 'src/types';
import { FilterQuery } from 'mongoose';
import { ChatActor } from 'src/types/chat-account';
import { CreateUserInput, PublicUser, UpdateUserInput, UserListQuery } from 'src/types/user';
import { BaseRepositoryAbstract } from 'src/repositories/base/base.abstract.repository';

const active: FilterQuery<User> = { deletedAt: null, pendingRoomAdminId: { $exists: false } };

class UserRepository extends BaseRepositoryAbstract<User> {
  constructor(readonly entity: typeof UserModel) {
    super(entity);
  }

  readonly publicFields = ['_id', 'name', 'email', 'code', 'role', 'createdAt', 'updatedAt'];

  async reserveForRoom(input: CreateUserInput, adminId: string) {
    const now = new Date();
    // Preserve the original credentials, owner and timestamps on retries or duplicate emails.
    return this.entity
      .findOneAndUpdate(
        { email: input.email },
        {
          $setOnInsert: {
            ...input,
            role: ROLE.USER,
            pendingRoomAdminId: adminId,
            createdAt: now,
            updatedAt: now,
          },
        },
        { upsert: true, new: true, runValidators: true, timestamps: false },
      )
      .select('+pendingRoomAdminId')
      .lean()
      .orFail();
  }

  async activateAfterRoom(id: string, adminId: string) {
    await this.entity.updateOne(
      { _id: id, deletedAt: null, pendingRoomAdminId: adminId },
      { $unset: { pendingRoomAdminId: 1 } },
    );
    return this.findPublicById(id);
  }

  async canCreateRoom(admin: ChatActor, user: ChatActor): Promise<boolean> {
    const users = await this.entity
      .find({ _id: { $in: [admin.accountId, user.accountId] }, deletedAt: null })
      .select('_id role +firebaseUid +pendingRoomAdminId')
      .lean();
    return [admin, user].every((actor) =>
      users.some(
        (record) =>
          String(record._id) === actor.accountId &&
          (record.firebaseUid || String(record._id)) === actor.uid &&
          record.role === actor.role &&
          (!record.pendingRoomAdminId ||
            (actor.role === ROLE.USER && record.pendingRoomAdminId === admin.accountId)),
      ),
    );
  }

  async findChatById(id: string) {
    return this.entity
      .findOne({ _id: id, ...active })
      .select('_id name email role +firebaseUid')
      .lean();
  }

  async findChatByEmail(email: string) {
    return this.entity
      .findOne({ email, ...active })
      .select('_id name email role +firebaseUid')
      .lean();
  }

  async chatRoles(uids: string[]): Promise<Map<string, RoleType>> {
    const wanted = new Set(uids);
    const ids = uids.filter((uid) => /^[a-f\d]{24}$/i.test(uid));
    const users = await this.entity
      .find({
        ...active,
        $or: [{ firebaseUid: { $in: uids } }, { _id: { $in: ids } }],
      })
      .select('_id role +firebaseUid')
      .lean();
    const roles = new Map<string, RoleType>();
    for (const user of users) {
      const uid = user.firebaseUid || String(user._id);
      if (wanted.has(uid) && isRole(user.role)) roles.set(uid, user.role);
    }
    return roles;
  }

  async chatUidOwnedByOther(uid: string, accountId: string): Promise<boolean> {
    return !!(await this.entity.exists({
      _id: { $ne: accountId },
      deletedAt: null,
      $or: [{ firebaseUid: uid }, ...(/^[a-f0-9]{24}$/i.test(uid) ? [{ _id: uid }] : [])],
    }));
  }

  async initialAdminExists(): Promise<boolean> {
    return !!(await this.entity.exists({ $or: [{ role: ROLE.ADMIN }, { initialAdmin: true }] }));
  }

  async ensureInitialAdminIndex(): Promise<void> {
    // Await the uniqueness constraint before accepting concurrent bootstrap registrations.
    await this.entity.collection.createIndex(
      { initialAdmin: 1 },
      {
        name: 'initial_admin_unique',
        unique: true,
        partialFilterExpression: { initialAdmin: true },
      },
    );
  }

  async userExist(email: string, excludeId?: string): Promise<boolean> {
    return !!(await this.entity.exists({
      email,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }));
  }

  async findPublicById(id: string): Promise<PublicUser | null> {
    return this.entity
      .findOne({ _id: id, ...active })
      .select(this.publicFields.join(' '))
      .lean();
  }

  async listPublic({ page, limit, search, role }: UserListQuery) {
    const filter: FilterQuery<User> = { ...active, ...(role ? { role } : {}) };
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }, { code: pattern }];
    }
    const [results, total] = await Promise.all([
      this.entity
        .find(filter)
        .select(this.publicFields.join(' '))
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.entity.countDocuments(filter),
    ]);
    return { results, total };
  }

  async updatePublicById(id: string, input: UpdateUserInput): Promise<PublicUser | null> {
    return this.entity
      .findOneAndUpdate({ _id: id, ...active }, { $set: input }, { new: true, runValidators: true })
      .select(this.publicFields.join(' '))
      .lean();
  }

  async beginDeletion(id: string) {
    const account = await this.entity
      .findOneAndUpdate(
        { _id: id, ...active },
        { $currentDate: { deletedAt: true } },
        { new: true },
      )
      .select('_id email name role +firebaseUid')
      .lean();
    if (account) return account;
    return this.entity
      .findOne({ _id: id, deletedAt: { $ne: null }, pendingRoomAdminId: { $exists: false } })
      .select('_id email name role +firebaseUid')
      .lean();
  }

  async finishDeletion(id: string): Promise<void> {
    await this.entity.deleteOne({ _id: id, deletedAt: { $ne: null } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.entity
      .findOne({ email, ...active })
      .select([...this.publicFields, 'password', 'deletedAt'])
      .lean();
  }
}

const userRepository = new UserRepository(UserModel);

export { userRepository, UserRepository };
