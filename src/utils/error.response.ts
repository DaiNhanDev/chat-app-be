import HttpStatus from 'http-status-codes';
import { ERROR_MESSAGE, ErrorCode } from 'src/constants/error.message';
import { Error as MongooseError } from 'mongoose';
import { mongo } from 'mongoose';
import Joi from 'joi';

class ErrorResponse extends Error {
  statusCode: number;
  errorCode: string;

  constructor(errorCode: string, message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationErrorCustom extends ErrorResponse {
  constructor(error: Joi.ValidationError | MongooseError.ValidationError) {
    let message = '';
    if (error instanceof Joi.ValidationError) {
      message = error.details.map((d) => d.message).join(', ');
    }
    if (error instanceof MongooseError.ValidationError) {
      message = Object.values(error.errors)
        .map((e) => e.message)
        .join(', ');
    }
    super(ERROR_MESSAGE.VALIDATION_ERROR, message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}

class DuplicateKeyErrorCustom extends ErrorResponse {
  constructor(mongoError: mongo.MongoServerError) {
    const field = Object.keys(mongoError.keyPattern ?? {})[0];
    const value = mongoError.keyValue?.[field || ''];
    const message = `Duplicate value for field "${field}": "${value}"`;
    const errorCode = `${field?.toUpperCase()}_${ERROR_MESSAGE.DUPLICATE_VALUE}`;
    super(errorCode, message, HttpStatus.CONFLICT);
  }
}

class ConflictRequestError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.DUPLICATE_VALUE,
    message = HttpStatus.getStatusText(HttpStatus.CONFLICT),
  ) {
    super(errorCode, message, HttpStatus.CONFLICT);
  }
}

class BadRequestError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.BAD_REQUEST,
    message = HttpStatus.getStatusText(HttpStatus.BAD_REQUEST),
  ) {
    super(errorCode, message, HttpStatus.BAD_REQUEST);
  }
}

class AuthError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.UNAUTHORIZED,
    message = HttpStatus.getStatusText(HttpStatus.UNAUTHORIZED),
  ) {
    super(errorCode, message, HttpStatus.UNAUTHORIZED);
  }
}

class ForbiddenError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.FORBIDDEN,
    message = HttpStatus.getStatusText(HttpStatus.FORBIDDEN),
  ) {
    super(errorCode, message, HttpStatus.FORBIDDEN);
  }
}

class NotFoundError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.NOT_FOUND,
    message = HttpStatus.getStatusText(HttpStatus.NOT_FOUND),
  ) {
    super(errorCode, message, HttpStatus.NOT_FOUND);
  }
}

class CastErrorCustom extends ErrorResponse {
  constructor(error: MongooseError.CastError) {
    const field = error.path;
    const value = error.value;
    const message = `Invalid value "${value}" for field "${field}"`;
    const errorCode = `${field?.toUpperCase()}_${ERROR_MESSAGE.CAST_ERROR}`;
    super(errorCode, message, HttpStatus.BAD_REQUEST);
  }
}

class PayloadTooLargeError extends ErrorResponse {
  constructor(
    errorCode: ErrorCode = ERROR_MESSAGE.PAYLOAD_TOO_LARGE,
    message = HttpStatus.getStatusText(HttpStatus.REQUEST_TOO_LONG),
  ) {
    super(errorCode, message, HttpStatus.REQUEST_TOO_LONG);
  }
}

class InternalServerError extends ErrorResponse {
  constructor() {
    super(
      ERROR_MESSAGE.INTERNAL_SERVER_ERROR,
      HttpStatus.getStatusText(HttpStatus.INTERNAL_SERVER_ERROR),
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}

export {
  ErrorResponse,
  ConflictRequestError,
  BadRequestError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  DuplicateKeyErrorCustom,
  ValidationErrorCustom,
  CastErrorCustom,
  PayloadTooLargeError,
  InternalServerError,
};
