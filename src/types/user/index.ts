import { RoleType } from 'src/constants';
import { Entity } from 'src/types/base';

export interface User extends Entity {
  name: string;
  email: string;
  password: string;
  role: RoleType;
  code?: string;
  initialAdmin?: boolean;
  firebaseUid?: string;
  pendingRoomAdminId?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  code?: string;
}

export interface CreateManagedUserInput extends CreateUserInput {
  role?: RoleType;
}

export type UpdateUserInput = Partial<CreateManagedUserInput>;
export type PublicUser = Omit<
  User,
  'password' | 'deletedAt' | 'initialAdmin' | 'firebaseUid' | 'pendingRoomAdminId'
>;

export interface UserListQuery {
  page: number;
  limit: number;
  search?: string;
  role?: RoleType;
}
