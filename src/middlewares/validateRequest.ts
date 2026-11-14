import { Schema } from 'joi';

import { Request, Response, NextFunction } from 'express';
import { ValidationErrorCustom } from 'src/utils/error.response';

/**
 * Generic Joi validation middleware
 * @param schema Joi schema
 * @param property request property (body | query | params)
 */

export const validateRequest =
  (schema: Schema, property: 'body' | 'query' | 'params' = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req[property], { abortEarly: false });
    if (error) {
      return next(new ValidationErrorCustom(error));
    }
    req[property] = value;
    return next();
  };
