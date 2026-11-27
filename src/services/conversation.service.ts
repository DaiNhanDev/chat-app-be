import { userRepository } from 'src/repositories/user.repository';
import { ConversationRepository } from 'src/repositories/conversation.repository';
import { ChatActor, CreateConversationInput } from 'src/types/chat-account';
import { ROLE, isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { BadRequestError, ForbiddenError, NotFoundError } from 'src/utils/error.response';
import { toChatActor } from 'src/services/chat-account.service';

export class ConversationService {
  constructor(private readonly repository: ConversationRepository) {}

  async findPerson(email: string) {
    const user = await userRepository.findChatByEmail(email);
    if (!user || !isRole(user.role)) return { person: null };
    return { person: { id: String(user._id), displayName: user.name } };
  }

  async create(actor: ChatActor, input: CreateConversationInput) {
    if (actor.role !== ROLE.ADMIN) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
    if (input.participantIds.length !== 1) throw new BadRequestError();
    const user = await userRepository.findChatById(input.participantIds[0]!);
    if (!user) throw new NotFoundError(ERROR_MESSAGE.USER_NOT_FOUND);
    return { conversation: await this.ensureUserRoom(actor, toChatActor(user)) };
  }

  async ensureUserRoom(admin: ChatActor, user: ChatActor) {
    if (admin.role !== ROLE.ADMIN) throw new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED);
    if (user.role !== ROLE.USER || admin.uid === user.uid)
      throw new BadRequestError(
        ERROR_MESSAGE.BAD_REQUEST,
        'A room requires one ADMIN and one USER',
      );
    if (await userRepository.chatUidOwnedByOther(user.uid, user.accountId))
      throw new Error('Chat identity belongs to another account');
    return this.repository.create(admin, user, () => userRepository.canCreateRoom(admin, user));
  }

  async list(uid: string) {
    return { conversations: await this.repository.list(uid) };
  }

  deleteForAccount(actor: ChatActor) {
    return this.repository.deleteForAccount(actor);
  }
}
