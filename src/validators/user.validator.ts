import Joi from 'joi';
import { ROLE } from 'src/constants';

const email = Joi.string().email().trim().lowercase().required();
const password = Joi.string().min(8).max(128).required();
const name = Joi.string().trim().max(150).required();

const code = Joi.string().trim().max(50);
const role = Joi.string().valid(...Object.values(ROLE));

export const userSchemas = {
  create: Joi.object({
    name,
    email,
    password,
    code: code.required(),
    role: role.default(ROLE.USER),
  }),
  update: Joi.object({
    name: name.optional(),
    email: email.optional(),
    password: password.optional(),
    code,
    role,
  }).min(1),
  idParams: Joi.object({
    id: Joi.string()
      .lowercase()
      .pattern(/^[a-f0-9]{24}$/)
      .required(),
  }),
  list: Joi.object({
    page: Joi.number().integer().min(1).max(1_000_000).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(150).empty(''),
    role,
  }),
  register: Joi.object({
    name,
    email,
    password,
    code: Joi.string().trim().max(50).required(),
  }),
  login: Joi.object({ email, password: Joi.string().required() }),
};
