import { createTokenPair, encryptSync, getInfoData } from 'src/utils';
import { compareSync } from 'bcrypt';
import { ConflictRequestError, AuthError } from 'src/utils/error.response';
import { userRepository } from 'src/repositories/user.repository';
import { ROLE, isRole } from 'src/constants';
import { omit } from 'lodash';
import { CreateUserInput } from 'src/types';
import { ERROR_MESSAGE } from 'src/constants/error.message';

type LoginInput = Pick<CreateUserInput, 'email' | 'password'>;

class AccessService {
  static async signUp({ email, name, password, code }: CreateUserInput) {
    const userExist: boolean = await userRepository.userExist(email);
    if (userExist) {
      throw new ConflictRequestError(ERROR_MESSAGE.USER_ALREADY_REGISTERED);
    }
    const passwordHash = encryptSync(password);

    const newUser = await userRepository.create({
      code,
      email,
      name,
      password: passwordHash,
      role: ROLE.USER,
    });
    return { user: getInfoData(['_id', 'name', 'email', 'role'], newUser) };
  }

  /**
   *
   */
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
  static async getUserByEmail(email: string) {
    const foundUser = await userRepository.findUserByEmail(email.toLowerCase());
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
