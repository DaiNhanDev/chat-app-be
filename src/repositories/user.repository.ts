import { UserModel } from 'src/models';
import { ROLE } from 'src/constants';
import { User } from 'src/types';
import { FilterQuery } from 'mongoose';
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
      { _id: id, pendingRoomAdminId: adminId },
      { $unset: { pendingRoomAdminId: 1 } },
    );
    return this.findPublicById(id);
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

  async deleteById(id: string): Promise<boolean> {
    const result = await this.entity.deleteOne({ _id: id, ...active });
    return result.deletedCount === 1;
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
