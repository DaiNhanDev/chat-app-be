import Joi from 'joi';

const email = Joi.string().email().trim().lowercase().required();
const password = Joi.string().min(8).max(128).required();
const name = Joi.string().trim().max(150).required();

export const userSchemas = {
  register: Joi.object({
    name,
    email,
    password,
    code: Joi.string().trim().max(50).required(),
  }),
  login: Joi.object({ email, password: Joi.string().required() }),
};
