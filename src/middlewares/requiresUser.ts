import { RequestHandler } from 'express';
import { OptionalAuthenticatedRequest } from 'src/types/http';
import { AuthError } from 'src/utils/error.response';
import { isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';

const requireUser: RequestHandler = (req: OptionalAuthenticatedRequest, _res, next) => {
  if (!req.user) return next(new AuthError());

  if (!req.user.userId || !req.user.email || !isRole(req.user.role)) {
    return next(new AuthError(ERROR_MESSAGE.INVALID_TOKEN, 'Access token payload is invalid'));
  }

  return next();
};

export default requireUser;
