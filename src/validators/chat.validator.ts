import Joi from 'joi';
import { isFirebaseKey } from 'src/utils/firebase-key';

// RTDB keys must be single path segments. Exclude inherited object keys as well.
const key = Joi.string()
  .max(128)
  .custom((value: string, helpers) => (isFirebaseKey(value) ? value : helpers.error('any.invalid')))
  .required();

export const chatSchemas = {
  conversationParams: Joi.object({
    conversationId: key.max(768),
  }),
  deviceParams: Joi.object({ deviceId: key }),
  message: Joi.object({
    text: Joi.string().trim().min(1).max(4000).required(),
    clientMessageId: key,
  }).rename('clientId', 'clientMessageId'),
  device: Joi.object({
    token: Joi.string()
      .max(4096)
      .pattern(/^\S+$/)
      .messages({ 'string.pattern.base': 'token must not contain whitespace' })
      .required(),
  }),
};
