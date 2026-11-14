import { NextFunction, Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';
import { mongo } from 'mongoose';
import Joi from 'joi';

import {
  ErrorResponse,
  NotFoundError,
  DuplicateKeyErrorCustom,
  ValidationErrorCustom,
  CastErrorCustom,
  BadRequestError,
  PayloadTooLargeError,
  InternalServerError,
} from 'src/utils/error.response';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { logger } from 'src/utils/logger';

/**
 * Error Handler Middleware
 */
export const normalizeError = (error: unknown): ErrorResponse => {
  let customError: ErrorResponse;

  if (error instanceof ErrorResponse) {
    customError = error;
  }
  // Mongo duplicate key (lỗi unique)
  else if (error instanceof mongo.MongoServerError && error.code === 11000) {
    customError = new DuplicateKeyErrorCustom(error);
  }
  // Joi validation
  else if (error instanceof Joi.ValidationError) {
    customError = new ValidationErrorCustom(error);
  }
  // Mongoose validation error
  else if (error instanceof MongooseError.ValidationError) {
    customError = new ValidationErrorCustom(error);
  } else if (error instanceof MongooseError.CastError) {
    customError = new CastErrorCustom(error);
  } else if (isHttpBodyError(error, 'entity.parse.failed')) {
    customError = new BadRequestError(
      ERROR_MESSAGE.INVALID_JSON,
      'Request body contains invalid JSON',
    );
  } else if (isHttpBodyError(error, 'entity.too.large') || hasStatus(error, 413)) {
    customError = new PayloadTooLargeError();
  }
  // Mặc định Internal Server Error
  else {
    customError = new InternalServerError();
  }

  return customError;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isHttpBodyError = (error: unknown, type: string) => isRecord(error) && error.type === type;

const hasStatus = (error: unknown, status: number) =>
  isRecord(error) && (error.status === status || error.statusCode === status);

export const createErrorPayload = (error: ErrorResponse, message = error.message) => ({
  success: false as const,
  statusCode: error.statusCode,
  errorCode: error.errorCode,
  message,
});

export const sanitizeErrorForResponse = (error: ErrorResponse): ErrorResponse => {
  return error.statusCode >= 500 ? new InternalServerError() : error;
};

export const errorHandler = (error: unknown, req: Request, res: Response, _next: NextFunction) => {
  const normalizedError = normalizeError(error);
  const customError = sanitizeErrorForResponse(normalizedError);
  logger.error('Error occurred:', {
    error,
  });
  const { statusCode, message } = customError;

  res.locals.errorMessage = message;

  const response = createErrorPayload(customError);

  const logRequestError = statusCode >= 500 ? logger.error : logger.warn;
  logRequestError('Request failed', {
    requestId: res.locals.requestId,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    errorCode: normalizedError.errorCode,
    originalStatusCode: normalizedError.statusCode,
    error,
  });

  return res.status(statusCode).json(response);
};

/**
 * NOT_FOUND(404) middleware to catch error response
 */
export function notFoundErrorHandler(_req: Request, res: Response, _next: NextFunction) {
  const notFound = new NotFoundError();
  return res.status(notFound.statusCode).json(createErrorPayload(notFound));
}
