import { Schema } from 'mongoose';
import { Entity } from 'src/types';

// Transform schema timestamps to millisecond timestamps
export const schemaTimestampTransform = {
  toJSON: {
    transform: (doc: any, ret: any) => {
      delete ret.__v;
      if (ret.createdAt) {
        ret.createdAt = ret.createdAt.getTime?.() || ret.createdAt;
      }
      if (ret.updatedAt) {
        ret.updatedAt = ret.updatedAt.getTime?.() || ret.updatedAt;
      }
      if (ret.deletedAt) {
        ret.deletedAt = ret.deletedAt.getTime?.() || ret.deletedAt;
      }
      return ret;
    },
  },
};

export class AppSchema<T extends Entity> extends Schema<T> {
  constructor(definition?: any, options?: any) {
    const fullDefinition = {
      ...definition,
      deletedAt: {
        type: Date,
        default: null,
      },
    };
    super(fullDefinition, {
      timestamps: true,
      versionKey: false,
      toJSON: schemaTimestampTransform.toJSON,
      toObject: schemaTimestampTransform.toJSON,
      ...options,
    });
  }
}
