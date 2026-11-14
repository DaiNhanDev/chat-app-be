import { Response } from 'express';
import HttpStatus from 'http-status-codes';
import { RESPONSE_MESSAGE } from 'src/constants/response';

interface SuccessResponseOptions<T> {
  data?: T | null;
  message?: string;
  statusCode?: number;
}

class SuccessResponse<T = unknown> {
  readonly success = true;
  readonly statusCode: number;
  readonly message: string;
  readonly data: T | null;

  constructor(options: SuccessResponseOptions<T> = {}) {
    this.statusCode = options.statusCode ?? HttpStatus.OK;
    this.message = options.message || RESPONSE_MESSAGE.OK;
    this.data = options.data ?? null;
  }

  send(res: Response) {
    return res.status(this.statusCode).json(this);
  }
}

class CREATED<T = unknown> extends SuccessResponse<T> {
  constructor(options: SuccessResponseOptions<T> = {}) {
    super({
      ...options,
      message: options.message || RESPONSE_MESSAGE.CREATED,
      statusCode: options.statusCode ?? HttpStatus.CREATED,
    });
  }
}

export { SuccessResponse, CREATED };
