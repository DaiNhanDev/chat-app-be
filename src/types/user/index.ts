import { RoleType } from 'src/constants';
import { Entity } from 'src/types/base';

export interface User extends Entity {
  name: string;
  email: string;
  password: string;
  role: RoleType;
  code?: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  code?: string;
}
