import { isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { userRepository } from 'src/repositories/user.repository';
import { ChatActor } from 'src/types/chat-account';
import { User } from 'src/types/user';
import { AuthError } from 'src/utils/error.response';
import { isFirebaseKey } from 'src/utils/firebase-key';

export const toChatActor = (
  user: Pick<User, '_id' | 'name' | 'email' | 'role' | 'firebaseUid'>,
): ChatActor => {
  const uid = user.firebaseUid || String(user._id);
  if (!isRole(user.role) || !isFirebaseKey(uid) || uid.length > 128)
    throw new Error('Invalid server-managed chat identity');
  return {
    accountId: String(user._id),
    uid,
    role: user.role,
    displayName: user.name,
    email: user.email,
  };
};

export const requireChatActor = async (accountId: string): Promise<ChatActor> => {
  const user = /^[a-f\d]{24}$/i.test(accountId)
    ? await userRepository.findChatById(accountId)
    : null;
  if (!user || !isRole(user.role)) throw new AuthError(ERROR_MESSAGE.AUTHENTICATED_USER_NOT_FOUND);
  const actor = toChatActor(user);
  if (await userRepository.chatUidOwnedByOther(actor.uid, actor.accountId))
    throw new Error('Chat identity belongs to another account');
  return actor;
};
