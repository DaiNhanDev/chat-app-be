import { createTokenPair, getInfoData } from 'src/utils';
import { compareSync } from 'bcrypt';
import { mongo } from 'mongoose';
import { encryptAsync } from 'src/utils/encrypt';
import { ConflictRequestError, AuthError } from 'src/utils/error.response';
import { userRepository } from 'src/repositories/user.repository';
import { ROLE, isRole } from 'src/constants';
import { omit } from 'lodash';
import { CreateUserInput } from 'src/types';
import { ERROR_MESSAGE } from 'src/constants/error.message';

import { requireChatActor } from 'src/services/chat-account.service';
import { createFirebaseReadToken } from 'src/configs/firebase.config';

import { sessionClaims } from 'src/utils/session-cookie';

type LoginInput = Pick<CreateUserInput, 'email' | 'password'>;

class AccessService {
  static async restoreSession(accessToken: string) {
    const { userId } = sessionClaims(accessToken);
    const user = await this.getCurrentUser(userId);
    return { user, tokens: { accessToken } };
  }

  static async createFirebaseReadSession(userId: string) {
    const actor = await requireChatActor(userId);
    return { customToken: await createFirebaseReadToken(actor.uid) };
  }

  static async registerAdmin({ name, email, password, code }: CreateUserInput) {
    const alreadyRegistered = () =>
      new ConflictRequestError(
        ERROR_MESSAGE.INITIAL_ADMIN_ALREADY_EXISTS,
        'Initial admin registration is already completed',
      );
    if (await userRepository.initialAdminExists()) throw alreadyRegistered();
    if (await userRepository.userExist(email)) {
      throw new ConflictRequestError(ERROR_MESSAGE.USER_ALREADY_REGISTERED);
    }
    await userRepository.ensureInitialAdminIndex();
    try {
      const user = await userRepository.create({
        name,
        email,
        password: await encryptAsync(password),
        code,
        role: ROLE.ADMIN,
        initialAdmin: true,
      });
      return { user: getInfoData(userRepository.publicFields, user) };
    } catch (error) {
      if (
        error instanceof mongo.MongoServerError &&
        error.code === 11000 &&
        error.keyPattern?.initialAdmin
      ) {
        throw alreadyRegistered();
      }
      throw error;
    }
  }

  static async login({ email, password }: LoginInput) {
    const foundUser = await userRepository.findUserByEmail(email.toLowerCase());
    if (!foundUser || !isRole(foundUser.role))
      throw new AuthError(
        ERROR_MESSAGE.EMAIL_OR_PASSWORD_INCORRECT,
        'Email or password is incorrect',
      );
    const match = compareSync(password, foundUser.password);
    if (!match)
      throw new AuthError(
        ERROR_MESSAGE.EMAIL_OR_PASSWORD_INCORRECT,
        'Email or password is incorrect',
      );

    const tokens = await createTokenPair({
      userId: foundUser._id,
      email,
      role: foundUser.role,
    });

    return {
      user: omit(foundUser, 'password'),
      tokens,
    };
  }

  /**
   *
   */
  static async getCurrentUser(userId: string) {
    const foundUser = /^[a-f\d]{24}$/i.test(userId)
      ? await userRepository.findPublicById(userId)
      : null;
    if (!foundUser || !isRole(foundUser.role)) {
      throw new AuthError(
        ERROR_MESSAGE.AUTHENTICATED_USER_NOT_FOUND,
        'Authenticated user no longer exists',
      );
    }

    return omit(foundUser, 'password');
  }
}

export { AccessService };
