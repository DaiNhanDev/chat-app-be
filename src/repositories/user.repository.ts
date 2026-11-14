import { UserModel } from 'src/models';
import { User } from 'src/types';
import { BaseRepositoryAbstract } from 'src/repositories/base/base.abstract.repository';

class UserRepository extends BaseRepositoryAbstract<User> {
  constructor(readonly entity: typeof UserModel) {
    super(entity);
  }

  userExist(email: string): Promise<boolean> {
    return new Promise((resolve, reject) =>
      this.findOne({ email })
        .then((emailExist) => resolve(!!emailExist))
        .catch((error) => reject(error)),
    );
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.entity.findOne({ email }).lean();
  }
}

const userRepository = new UserRepository(UserModel);

export { userRepository, UserRepository };
