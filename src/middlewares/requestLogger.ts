import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { logger } from 'src/utils/logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const requestId = req.get('x-request-id') || randomUUID();
  const startedAt = process.hrtime.bigint();

  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const metadata = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      ip: req.ip,
      userId: res.locals.userId,
    };

    if (res.statusCode >= 500) logger.error('HTTP request completed', metadata);
    else if (res.statusCode >= 400) logger.warn('HTTP request completed', metadata);
    else logger.info('HTTP request completed', metadata);
  });

  next();
};
