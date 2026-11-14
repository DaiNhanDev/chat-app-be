import { Response, NextFunction } from 'express';
import { verify } from 'src/utils/jwt';
import { AuthenticatedUser, OptionalAuthenticatedRequest } from 'src/types/http';
import { AuthError } from 'src/utils/error.response';
import { isRole } from 'src/constants';
import { ERROR_MESSAGE } from 'src/constants/error.message';

const deserializeUser = (req: OptionalAuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const authorization = req.get('authorization');
    if (!authorization) return next();

    const [scheme, token, extra] = authorization.trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      return next(
        new AuthError(ERROR_MESSAGE.INVALID_TOKEN, 'Authorization header must use Bearer token'),
      );
    }

    const { decoded, expired, valid } = verify(token);
    if (valid && !expired && isAuthenticatedUser(decoded)) {
      req.user = decoded;
      res.locals.userId = decoded?.userId;
      return next();
    }
    if (expired) {
      throw new AuthError(ERROR_MESSAGE.TOKEN_EXPIRED, 'Access token has expired');
    }
    throw new AuthError(ERROR_MESSAGE.INVALID_TOKEN, 'Access token is invalid');
  } catch (error) {
    next(error);
  }
};

const isAuthenticatedUser = (value: unknown): value is AuthenticatedUser => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === 'string' &&
    typeof candidate.userId === 'string' &&
    isRole(candidate.role)
  );
};

export default deserializeUser;
