import { ROLE } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { userRepository } from 'src/repositories/user.repository';
import {
  CreateManagedUserInput,
  CreateUserInput,
  UpdateUserInput,
  UserListQuery,
} from 'src/types/user';
import {
  BadRequestError,
  ConflictRequestError,
  ForbiddenError,
  NotFoundError,
} from 'src/utils/error.response';
import { encryptAsync } from 'src/utils/encrypt';
import { getInfoData } from 'src/utils';
import { compare } from 'bcrypt';
import { requireChatActor, toChatActor } from 'src/services/chat-account.service';
import { conversationService } from 'src/services/firebase.service';

class UserService {
  static async createAdmin(input: CreateUserInput) {
    if (await userRepository.userExist(input.email))
      throw new ConflictRequestError(ERROR_MESSAGE.USER_ALREADY_REGISTERED);
    const user = await userRepository.create({
      ...input,
      password: await encryptAsync(input.password),
      role: ROLE.ADMIN,
    });
    return { user: getInfoData(userRepository.publicFields, user) };
  }

  static async create(input: CreateManagedUserInput, actorId: string) {
    const admin = await requireChatActor(actorId);
    if (admin.role !== ROLE.ADMIN) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
    if (input.role === ROLE.ADMIN) return this.createAdmin(input);

    const { name, email, code, password } = input;
    const pending = await userRepository.reserveForRoom(
      { name, email, code, password: await encryptAsync(password) },
      actorId,
    );
    if (
      pending.pendingRoomAdminId !== actorId ||
      pending.name !== name ||
      pending.code !== code ||
      !(await compare(password, pending.password))
    ) {
      throw new ConflictRequestError(ERROR_MESSAGE.USER_ALREADY_REGISTERED);
    }
    const conversation = await conversationService.ensureUserRoom(admin, toChatActor(pending));
    const user = await userRepository.activateAfterRoom(String(pending._id), actorId);
    if (!user) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    return { user, conversation };
  }

  static async list(query: UserListQuery) {
    const { results, total } = await userRepository.listPublic(query);
    return {
      paginate: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
      results,
    };
  }

  static async getById(id: string) {
    const user = await userRepository.findPublicById(id);
    if (!user) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    return { user };
  }

  static async update(id: string, input: UpdateUserInput, actorId: string) {
    if (id === actorId && input.role && input.role !== ROLE.ADMIN) {
      throw new BadRequestError(ERROR_MESSAGE.BAD_REQUEST, 'Cannot remove your own admin role');
    }
    await this.getById(id);
    if (input.email && (await userRepository.userExist(input.email, id))) {
      throw new ConflictRequestError(ERROR_MESSAGE.EMAIL_ALREADY_REGISTERED);
    }
    const { name, email, code, role, password } = input;
    const updated = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(code !== undefined ? { code } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(password !== undefined ? { password: await encryptAsync(password) } : {}),
    };
    const user = await userRepository.updatePublicById(id, updated);
    if (!user) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    return { user };
  }

  static async deleteById(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestError(ERROR_MESSAGE.BAD_REQUEST, 'Cannot delete your own admin account');
    }
    const account = await userRepository.beginDeletion(id);
    if (!account) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    await conversationService.deleteForAccount(toChatActor(account));
    await userRepository.finishDeletion(id);
    return { id, deleted: true };
  }
}

export { UserService };
