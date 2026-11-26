import Joi from 'joi';
import { isFirebaseKey } from 'src/utils/firebase-key';

// RTDB keys must be single path segments. Exclude inherited object keys as well.
const key = Joi.string()
  .max(128)
  .custom((value: string, helpers) => (isFirebaseKey(value) ? value : helpers.error('any.invalid')))
  .required();

export const chatSchemas = {
  people: Joi.object({ email: Joi.string().email().trim().lowercase().required() }),
  conversation: Joi.object({
    participantIds: Joi.array()
      .items(
        Joi.string()
          .lowercase()
          .pattern(/^[a-f0-9]{24}$/)
          .required(),
      )
      .length(1)
      .required(),
    title: Joi.string().valid(''),
  }),
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
