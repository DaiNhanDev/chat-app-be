import { Schema } from 'mongoose';

export interface Entity {
  _id?: Schema.Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

export interface AppType extends Entity {
  name: string;
  code: string;
}

export type UpdatedModel = {
  matchedCount: number;
  modifiedCount: number;
  acknowledged: boolean;
  upsertedId: unknown | Schema.Types.ObjectId;
  upsertedCount: number;
};
export type RemovedModel = {
  deletedCount: number;
  deleted: boolean;
};
export type CreatedModel = {
  _id: Schema.Types.ObjectId;
  created: boolean;
};
export type CreatedOrUpdateModel = {
  _id: Schema.Types.ObjectId;
  created: boolean;
  updated: boolean;
};
export enum DatabaseOperationEnum {
  EQUAL = 'equal',
  NOT_EQUAL = 'not_equal',
  NOT_CONTAINS = 'not_contains',
  CONTAINS = 'contains',
}
export type DatabaseOperationCommand<T> = {
  property: keyof T;
  value: unknown[];
  command: DatabaseOperationEnum;
};
