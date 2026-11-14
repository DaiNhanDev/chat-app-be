import { model } from 'mongoose';
import { ROLE } from 'src/constants';
import { User } from 'src/types';
import { AppSchema } from 'src/models/app.schema';

const DOCUMENT_NAME = 'User';
const COLLECTION_NAME = 'Users';

const userSchema = new AppSchema<User>(
  {
    name: {
      type: String,
      trim: true,
      required: true,
      maxLength: 150,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(ROLE),
      default: ROLE.USER,
      required: true,
    },
    code: { type: String },
  },
  {
    collection: COLLECTION_NAME,
  },
);

userSchema.index(
  { code: 1 },
  {
    name: 'code_unique_present',
    unique: true,
    partialFilterExpression: { code: { $type: 'string' } },
  },
);

export const UserModel = model(DOCUMENT_NAME, userSchema);
