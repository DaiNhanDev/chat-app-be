import { RoleType } from 'src/constants';
import { NextFunction, Request, Response } from 'express';

export interface AuthenticatedUser {
  email: string;
  userId: string;
  role: RoleType;
}

export interface AuthenticatedRequest<TBody = any> extends Request {
  user: AuthenticatedUser;
  body: TBody;
}

export interface OptionalAuthenticatedRequest<TBody = any> extends Request {
  user?: AuthenticatedUser;
  body: TBody;
}

export type ControllerFunction<TRequest extends Request = Request> = (
  req: TRequest,
  res: Response,
  next: NextFunction,
) => unknown | Promise<unknown>;
