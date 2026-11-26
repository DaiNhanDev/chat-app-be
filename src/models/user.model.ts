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
      lowercase: true,
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
    initialAdmin: { type: Boolean, select: false },
    // Cleared only after the user's room and both RTDB indexes are ready.
    pendingRoomAdminId: { type: String, select: false },
    // Only an administrator migration may assign this field, never a public API.
    firebaseUid: { type: String, unique: true, sparse: true, select: false },
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

userSchema.index(
  { initialAdmin: 1 },
  {
    name: 'initial_admin_unique',
    unique: true,
    partialFilterExpression: { initialAdmin: true },
  },
);

export const UserModel = model(DOCUMENT_NAME, userSchema);
