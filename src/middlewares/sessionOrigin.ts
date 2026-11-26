import { RequestHandler } from 'express';
import { env } from 'src/configs/env.config';
import { ForbiddenError } from 'src/utils/error.response';

const originOf = (value: string) => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

// Cookie endpoints must not inherit the API's optional wildcard CORS policy.
export const sessionOrigin: RequestHandler = (req, _res, next) => {
  const origin = req.get('origin');
  if (!origin) {
    return req.get('sec-fetch-site') === 'cross-site' ? next(new ForbiddenError()) : next();
  }
  const trusted = [
    `${req.protocol}://${req.get('host')}`,
    env.pwaBaseUrl,
    ...env.corsOrigins.filter((value) => value !== '*'),
  ]
    .map(originOf)
    .filter(Boolean);
  if (origin === 'null' || !trusted.includes(origin)) return next(new ForbiddenError());
  return next();
};
