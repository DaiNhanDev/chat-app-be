import { pick } from 'lodash';
import { Schema } from 'mongoose';
export * from 'src/utils/encrypt';
export * from 'src/utils/auth/auth.utils';

// Convert Date objects to timestamp
export const convertTimestamps = (data: Record<string, any>): Record<string, any> => {
  if (!data) return data;

  if (data.createdAt && data.createdAt instanceof Date) {
    data.createdAt = data.createdAt.getTime();
  }
  if (data.updatedAt && data.updatedAt instanceof Date) {
    data.updatedAt = data.updatedAt.getTime();
  }

  return data;
};

export const getInfoData = (fields: string[], object = {}) => pick(object, fields);

export const getSelectData = (select: string[] = []) =>
  Object.fromEntries(select.map((m) => [m, 1]));

export const getUnSelectData = (select: string[] = []) =>
  Object.fromEntries(select.map((m) => [m, 0]));

export const removeUndefinedObject = (obj: Record<string, any> = {}) => {
  Object.keys(obj).forEach((k) => {
    if (obj[k] === null || obj[k] === undefined) {
      delete obj[k];
    }
  });

  return obj;
};

export const updateNestedObjectParser = (obj: Record<string, any> = {}) => {
  const final: Record<string, any> = {};

  Object.keys(obj).forEach((k) => {
    if (typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
      const response: any = updateNestedObjectParser(obj[k]);

      Object.keys(response).forEach((a) => {
        final[`${k}.${a}`] = response[a];
      });
    } else {
      final[k] = obj[k];
    }
  });

  return final;
};

export const convertToObjectId: (id: string) => Schema.Types.ObjectId = (id: string) =>
  new Schema.Types.ObjectId(id);

export const transformToTimestamp = (obj: any): any => {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map((i) => transformToTimestamp(i));
  }
  if (typeof obj === 'object' && obj !== null) {
    // If it's a Mongoose document, convert to object first
    const data = obj.toObject ? obj.toObject() : obj;
    Object.keys(data).forEach((key) => {
      if (data[key] instanceof Date) {
        data[key] = data[key].getTime();
      } else if (typeof data[key] === 'object' && data[key] !== null) {
        data[key] = transformToTimestamp(data[key]);
      }
    });
    return data;
  }
  return obj;
};
