import { RequestHandler } from 'express';
import { isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { userRepository } from 'src/repositories/user.repository';
import { OptionalAuthenticatedRequest } from 'src/types/http';
import { AuthError } from 'src/utils/error.response';

// Management permissions must reflect the current account, rather than a stale JWT role.
export const requireCurrentUser: RequestHandler = (
  req: OptionalAuthenticatedRequest,
  res,
  next,
) => {
  if (!req.user || !/^[a-f\d]{24}$/i.test(req.user.userId)) return next(new AuthError());
  userRepository
    .findPublicById(req.user.userId)
    .then((user) => {
      if (!user || !isRole(user.role)) {
        return next(new AuthError(ERROR_MESSAGE.AUTHENTICATED_USER_NOT_FOUND));
      }
      req.user = { userId: String(user._id), email: user.email, role: user.role };
      res.locals.userId = req.user.userId;
      return next();
    })
    .catch(next);
};
