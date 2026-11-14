import { Request, RequestHandler } from 'express';
import { ControllerFunction } from 'src/types/http';

export function catchError<TRequest extends Request>(
  fn: ControllerFunction<TRequest>,
): RequestHandler {
  return (req, res, next): void => {
    Promise.resolve(fn(req as TRequest, res, next)).catch(next);
  };
}
