import { RequestHandler } from 'express';
import { OptionalAuthenticatedRequest } from 'src/types/http';
import { ForbiddenError, AuthError } from 'src/utils/error.response';
import { RoleType, isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';

export const checkRole = (allowedRoles: RoleType[]): RequestHandler => {
  return (req: OptionalAuthenticatedRequest, _res, next) => {
    if (!isRole(req.user?.role)) {
      return next(new AuthError(ERROR_MESSAGE.UNAUTHORIZED));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError(ERROR_MESSAGE.PERMISSION_DENIED));
    }

    return next();
  };
};
