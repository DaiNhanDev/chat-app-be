import { env } from 'src/configs/env.config';

export enum ROLE {
  ADMIN = 'ADMIN',
  USER = 'USER',
}

export type RoleType = ROLE;

export const isRole = (value: unknown): value is RoleType =>
  value === ROLE.ADMIN || value === ROLE.USER;

export const secretKey = env.jwtSecret;
