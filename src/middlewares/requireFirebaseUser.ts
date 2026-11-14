import { RequestHandler } from 'express';
import { verifyFirebaseIdToken } from 'src/configs/firebase.config';
import { AuthError } from 'src/utils/error.response';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { FirebaseRequest } from 'src/types/chat';
import { isFirebaseKey } from 'src/utils/firebase-key';

export type FirebaseTokenVerifier = (token: string) => Promise<{ uid: string }>;

export const requireFirebaseUser = (
  verify: FirebaseTokenVerifier = verifyFirebaseIdToken,
): RequestHandler => {
  return (req, _res, next) => {
    const [scheme, token, extra] = (req.get('authorization') || '').trim().split(/\s+/);
    if (scheme?.toLowerCase() !== 'bearer' || !token || extra) {
      return next(new AuthError(ERROR_MESSAGE.INVALID_TOKEN, 'Firebase ID token is required'));
    }
    Promise.resolve()
      .then(() => verify(token))
      .then(({ uid }) => {
        if (!isFirebaseKey(uid)) throw new AuthError();
        (req as FirebaseRequest).firebaseUser = { uid };
        next();
      })
      .catch(() =>
        next(new AuthError(ERROR_MESSAGE.INVALID_TOKEN, 'Firebase ID token is invalid')),
      );
  };
};
