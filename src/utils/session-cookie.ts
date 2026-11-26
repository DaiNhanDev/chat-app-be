import { CookieOptions, Request, Response } from 'express';
import { env } from 'src/configs/env.config';
import { AuthError } from 'src/utils/error.response';
import { verify } from 'src/utils/jwt';
import { isRole } from 'src/constants';

const cookieName = 'chatapp_session';
const options = (req: Request): CookieOptions => ({
  httpOnly: true,
  secure: req.secure || env.nodeEnv === 'production',
  sameSite: env.sessionCookieSameSite,
  path: '/api/v1/auth',
});

export const readSessionToken = (req: Request): string => {
  const values = (req.headers.cookie || '').split(';').map((value) => value.trim());
  const raw = values.find((value) => value.startsWith(cookieName + '='));
  if (!raw) throw new AuthError();
  try {
    const token = decodeURIComponent(raw.slice(cookieName.length + 1));
    if (!token || token.length > 4096) throw new AuthError();
    return token;
  } catch {
    throw new AuthError();
  }
};

export const sessionClaims = (token: string) => {
  const { valid, decoded } = verify(token);
  if (
    !valid ||
    !decoded ||
    typeof decoded !== 'object' ||
    (decoded.tokenUse !== undefined && decoded.tokenUse !== 'access') ||
    typeof decoded.userId !== 'string' ||
    !/^[a-f\d]{24}$/i.test(decoded.userId) ||
    typeof decoded.email !== 'string' ||
    !isRole(decoded.role) ||
    typeof decoded.exp !== 'number' ||
    decoded.exp * 1000 <= Date.now()
  )
    throw new AuthError();
  return { userId: decoded.userId, expiresAt: decoded.exp * 1000 };
};

export const setSessionCookie = (req: Request, res: Response, token: string) => {
  const { expiresAt } = sessionClaims(token);
  const cookieOptions = options(req);
  if (cookieOptions.sameSite === 'none' && !cookieOptions.secure)
    throw new Error('SameSite=None session cookies require HTTPS');
  res.cookie(cookieName, token, {
    ...cookieOptions,
    maxAge: expiresAt - Date.now(),
  });
};

export const clearSessionCookie = (req: Request, res: Response) => {
  res.clearCookie(cookieName, options(req));
};
