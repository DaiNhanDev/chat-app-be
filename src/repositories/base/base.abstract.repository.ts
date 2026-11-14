import {
  FilterQuery,
  InsertManyOptions,
  Model,
  QueryOptions,
  SaveOptions,
  Schema,
  UpdateQuery,
  UpdateWithAggregationPipeline,
} from 'mongoose';
import { mongo } from 'mongoose';

type UpdateOptions = mongo.UpdateOptions;
import {
  CreatedModel,
  CreatedOrUpdateModel,
  DatabaseOperationCommand,
  Entity,
  RemovedModel,
  UpdatedModel,
} from 'src/types';
import { IBaseRepository } from 'src/repositories/base/base.inteface.repository';
import { validateFindByCommandsFilter } from 'src/utils/mongoose';
import { BadRequestError, NotFoundError } from 'src/utils/error.response';
import { ERROR_MESSAGE } from 'src/constants/error.message';
import { convertTimestamps } from 'src/utils';

export abstract class BaseRepositoryAbstract<T extends Entity> implements IBaseRepository<T> {
  protected constructor(private readonly model: Model<T>) {
    this.model = model;
  }
  async insertMany<TOptions = unknown>(documents: T[], saveOptions?: TOptions): Promise<void> {
    await this.model.insertMany(documents, saveOptions as InsertManyOptions);
  }

  async save<TOptions = SaveOptions>(document: T, saveOptions?: TOptions): Promise<CreatedModel> {
    const createdEntity = new this.model({ ...document, _id: document._id });
    const savedResult = await createdEntity.save(saveOptions as SaveOptions);

    return { _id: savedResult._id as Schema.Types.ObjectId, created: true };
  }

  async create(document: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return await this.model.create(document);
  }

  async createOrUpdate<TDocument = Entity, TOptions = SaveOptions & UpdateOptions>(
    document: TDocument,
    options?: TOptions,
  ): Promise<CreatedOrUpdateModel> {
    const documentEntity: Entity = document as Entity;
    if (!documentEntity?._id) {
      throw new BadRequestError(ERROR_MESSAGE.ID_IS_REQUIRE, 'id is required');
    }

    const exists = await this.findById(documentEntity?._id);

    if (!exists) {
      const createdEntity = new this.model({
        ...document,
        _id: documentEntity?._id,
      });
      const savedResult = await createdEntity.save(options as SaveOptions);

      return { _id: savedResult._id as Schema.Types.ObjectId, created: true, updated: false };
    }

    await this.model.updateOne(
      { _id: exists._id },
      document as UpdateWithAggregationPipeline | UpdateQuery<T>,
      options as UpdateOptions,
    );

    return { _id: documentEntity._id, created: false, updated: true };
  }

  async find<TQuery = FilterQuery<T>, TOptions = QueryOptions>(
    filter: TQuery,
    options?: TOptions,
  ): Promise<T[]> {
    const data = await this.model
      .find(filter as FilterQuery<T>, undefined, options as QueryOptions)
      .lean();
    return data?.map((item) => this.convertData(item)) || [];
  }

  async findById(id: Schema.Types.ObjectId | string): Promise<T | null> {
    const data = await this.model.findById(id).lean();
    return this.convertData(data);
  }

  async findOne<TQuery = FilterQuery<T>, TOptions = QueryOptions>(
    filter: TQuery,
    options?: TOptions,
  ): Promise<T | null> {
    const data = await this.model
      .findOne(filter as FilterQuery<T>, undefined, options as QueryOptions)
      .lean();
    return this.convertData(data);
  }

  async findAll<TQuery = FilterQuery<T>>(filter?: TQuery): Promise<T[]> {
    const data = await this.model
      .find(filter as FilterQuery<T>)
      .lean()
      .exec();
    return data?.map((item) => this.convertData(item)) || [];
  }

  async remove<TQuery = FilterQuery<T>>(filter: TQuery): Promise<RemovedModel> {
    const { deletedCount } = await this.model.deleteOne(filter as FilterQuery<T>);
    return { deletedCount, deleted: !!deletedCount };
  }

  async updateOne<
    TQuery = FilterQuery<T>,
    TUpdate = UpdateWithAggregationPipeline | UpdateQuery<T>,
    TOptions = UpdateOptions,
  >(filter: TQuery, updated: TUpdate, options?: TOptions): Promise<UpdatedModel> {
    return await this.model.updateOne(
      filter as FilterQuery<T>,
      updated as UpdateWithAggregationPipeline | UpdateQuery<T>,
      options as UpdateOptions,
    );
  }

  async findOneAndUpdate<
    TQuery = FilterQuery<T>,
    TUpdate = UpdateWithAggregationPipeline | UpdateQuery<T>,
    TOptions = UpdateOptions,
  >(filter: TQuery, updated: TUpdate, options?: TOptions): Promise<T | null> {
    const model = await this.model
      .findOneAndUpdate(
        filter as FilterQuery<T>,
        updated as UpdateWithAggregationPipeline | UpdateQuery<T>,
        { new: true, ...options } as QueryOptions,
      )
      .lean();

    return this.convertData(model);
  }

  async findByIdAndUpdate<TUpdate = Partial<T>, TOptions = { new?: boolean; upsert?: boolean }>(
    _id: Schema.Types.ObjectId | string,
    updated: TUpdate,
    options?: TOptions,
  ): Promise<T | null> {
    const data = await this.model
      .findByIdAndUpdate(
        _id,
        updated as UpdateQuery<T>,
        { new: true, runValidators: true, ...options } as QueryOptions,
      )
      .lean<T>()
      .exec();

    return this.convertData(data);
  }

  async updateMany<
    TQuery = FilterQuery<T>,
    TUpdate = UpdateWithAggregationPipeline | UpdateQuery<T>,
    TOptions = UpdateOptions,
  >(filter: TQuery, updated: TUpdate, options?: TOptions): Promise<UpdatedModel> {
    return await this.model.updateMany(
      filter as FilterQuery<T>,
      updated as UpdateWithAggregationPipeline | UpdateQuery<T>,
      options as UpdateOptions,
    );
  }

  async findIn<TOptions = QueryOptions>(
    input: Partial<Record<keyof T | 'id', string[]>>,
    options?: TOptions,
  ): Promise<T[]> {
    const key = Object.keys(input)[0];
    if (!key) {
      throw new BadRequestError(ERROR_MESSAGE.BAD_REQUEST, 'At least one search field is required');
    }
    const inputKey = key === 'id' ? '_id' : key;
    const filter: FilterQuery<T> = {
      [inputKey]: { $in: input[key as keyof typeof input] },
      deletedAt: null,
    } as FilterQuery<T>;
    const data = await this.model.find(filter, null, options as QueryOptions);
    return data?.map((item) => this.convertData(item)) || [];
  }

  async findByCommands<TOptions = QueryOptions>(
    filterList: DatabaseOperationCommand<T>[],
    options?: TOptions,
  ): Promise<T[]> {
    const mongoSearch = {
      equal: { type: '$in', like: false },
      not_equal: { type: '$nin', like: false },
      not_contains: { type: '$nin', like: true },
      contains: { type: '$in', like: true },
    };

    const searchList = {};

    validateFindByCommandsFilter(filterList);

    for (const filter of filterList) {
      const command = mongoSearch[filter.command];

      if (command.like) {
        Object.assign(searchList, {
          [filter.property]: {
            [command.type]: filter.value.map((value) => new RegExp(`^${value}`, 'i')),
          },
        });
        continue;
      }

      Object.assign(searchList, {
        [filter.property]: { [command.type]: filter.value },
      });
    }

    Object.assign(searchList, { deletedAt: null });

    const data = await this.model.find(searchList, null, options as QueryOptions).lean();

    return data?.map((item) => this.convertData(item)) || [];
  }

  async findOneWithExcludeFields<TQuery = FilterQuery<T>, TOptions = QueryOptions>(
    filter: TQuery,
    excludeProperties: Array<keyof T>,
    options?: TOptions,
  ): Promise<T | null> {
    const exclude = excludeProperties.map((e) => `-${e.toString()}`);

    const data = await this.model
      .findOne(filter as FilterQuery<T>, undefined, options as QueryOptions)
      .select(exclude.join(' '));

    if (!data) return null;

    return this.convertData(data.toObject({ virtuals: true }));
  }

  async findAllWithExcludeFields<TQuery = FilterQuery<T>, TOptions = QueryOptions>(
    excludeProperties: Array<keyof T>,
    filter?: TQuery,
    options?: TOptions,
  ): Promise<T[]> {
    const exclude = excludeProperties.map((e) => `-${e.toString()}`);

    const where = this.applyFilterWhenFilterParameterIsNotFirstOption(filter as FilterQuery<T>);

    const data = await this.model
      .find(where as FilterQuery<T>, undefined, options as QueryOptions)
      .select(exclude.join(' '))
      .lean();

    return data?.map((item) => this.convertData(item)) || [];
  }

  async findOneWithSelectFields<TQuery = Partial<T>, TOptions = unknown>(
    filter: TQuery,
    includeProperties: Array<keyof T>,
    options?: TOptions,
  ): Promise<T | null> {
    const exclude = includeProperties.map((e) => `${e.toString()}`);

    const data = await this.model
      .findOne(filter as FilterQuery<T>, undefined, options as QueryOptions)
      .select(exclude.join(' '))
      .lean();

    if (!data) return null;

    return this.convertData(data);
  }

  async findAllWithSelectFields<TQuery = FilterQuery<T>, TOptions = QueryOptions>(
    includeProperties: Array<keyof T>,
    filter?: TQuery,
    options?: TOptions,
  ): Promise<T[]> {
    const exclude = includeProperties.map((e) => `${e.toString()}`);

    const where = this.applyFilterWhenFilterParameterIsNotFirstOption(filter as FilterQuery<T>);

    const data = await this.model
      .find(where as FilterQuery<T>, undefined, options as QueryOptions)
      .select(exclude.join(' '))
      .lean();

    return data?.map((item) => this.convertData(item)) || [];
  }

  private applyFilterWhenFilterParameterIsNotFirstOption(filter?: FilterQuery<T>) {
    const normalizedFilter: FilterQuery<T> = { ...(filter ?? { deletedAt: null }) };

    if (normalizedFilter.id) {
      normalizedFilter._id = normalizedFilter.id;
      delete normalizedFilter.id;
    }

    return normalizedFilter;
  }

  async deleteMany<TQuery = FilterQuery<T>>(
    filter: TQuery | { ids: (string | Schema.Types.ObjectId)[] },
  ): Promise<RemovedModel> {
    let query: FilterQuery<T>;

    if (this.hasIds(filter)) {
      query = { _id: { $in: filter.ids } } as FilterQuery<T>;
    } else {
      query = filter as FilterQuery<T>;
    }

    const { deletedCount, acknowledged } = await this.model.deleteMany(query);

    return {
      deletedCount,
      deleted: acknowledged && deletedCount > 0,
    };
  }

  private hasIds(value: unknown): value is { ids: (string | Schema.Types.ObjectId)[] } {
    return (
      typeof value === 'object' && value !== null && 'ids' in value && Array.isArray(value.ids)
    );
  }

  async deleteManyByIds(ids: (string | Schema.Types.ObjectId)[]): Promise<RemovedModel> {
    const foundCount = await this.model.countDocuments({ _id: { $in: ids } });

    if (foundCount !== ids.length) {
      throw new NotFoundError();
    }

    const { deletedCount, acknowledged } = await this.model.deleteMany({
      _id: { $in: ids },
    });

    return {
      deletedCount,
      deleted: acknowledged && deletedCount > 0,
    };
  }

  async softRemove<TQuery = FilterQuery<T>>(filter: TQuery): Promise<RemovedModel> {
    const { modifiedCount } = await this.model.updateOne(filter as FilterQuery<T>, {
      deletedAt: new Date(),
    });
    return { deletedCount: modifiedCount, deleted: !!modifiedCount };
  }

  async softDeleteManyByIds(ids: (string | Schema.Types.ObjectId)[]): Promise<RemovedModel> {
    const foundCount = await this.model.countDocuments({
      _id: { $in: ids },
      deletedAt: null,
    });

    if (foundCount !== ids.length) {
      throw new NotFoundError();
    }

    const { modifiedCount, acknowledged } = await this.model.updateMany(
      { _id: { $in: ids } },
      { deletedAt: new Date() },
    );

    return {
      deletedCount: modifiedCount,
      deleted: acknowledged && modifiedCount > 0,
    };
  }

  async count<TQuery = FilterQuery<T>>(filter: TQuery): Promise<number> {
    return await this.model.countDocuments(filter as FilterQuery<T>);
  }

  // Generic method để convert timestamps và apply custom converter
  protected convertData<R = T>(data: unknown, converter?: (data: any) => R): R {
    if (!data) return null as R;

    // Luôn convert timestamps
    const withTimestamps = convertTimestamps(data);

    // Apply custom converter nếu có
    if (converter) {
      return converter(withTimestamps);
    }

    return withTimestamps as R;
  }
}
