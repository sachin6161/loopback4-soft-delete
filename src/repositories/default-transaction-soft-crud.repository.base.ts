import {
  DataObject,
  Filter,
  juggler,
  DefaultTransactionalRepository,
  Where,
  Getter,
  Entity,
} from '@loopback/repository';
import {Count} from '@loopback/repository/src/common-types';
import {Options} from 'loopback-datasource-juggler';
import {SoftDeleteEntity} from '../models';
import {IAuthUser} from 'loopback4-authentication';
import {HttpErrors} from '@loopback/rest';
import {ErrorKeys} from '../error-keys';
import {produceSoftDeleteFilter, produceSoftDeleteWhere} from './repo-utils';

export abstract class DefaultTransactionSoftCrudRepository<
  T extends SoftDeleteEntity,
  ID,
  Relations extends object = {},
> extends DefaultTransactionalRepository<T, ID, Relations> {
  constructor(
    entityClass: typeof Entity & {
      prototype: T;
    },
    dataSource: juggler.DataSource,
    protected readonly getCurrentUser?: Getter<IAuthUser | undefined>,
  ) {
    super(entityClass, dataSource);
  }

  find(filter?: Filter<T>, options?: Options): Promise<(T & Relations)[]> {
    // Filter out soft deleted entries
    filter = produceSoftDeleteFilter(filter);

    // Now call super
    return super.find(filter, options);
  }

  //find all enteries even with soft deleted records
  findAll(filter?: Filter<T>, options?: Options): Promise<(T & Relations)[]> {
    return super.find(filter, options);
  }

  findOne(
    filter?: Filter<T>,
    options?: Options,
  ): Promise<(T & Relations) | null> {
    filter = produceSoftDeleteFilter(filter);

    // Now call super
    return super.findOne(filter, options);
  }

  //findOne() including soft deleted entry
  findOneIncludeSoftDelete(
    filter?: Filter<T>,
    options?: Options,
  ): Promise<(T & Relations) | null> {
    return super.findOne(filter, options);
  }

  async findById(
    id: ID,
    filter?: Filter<T>,
    options?: Options,
  ): Promise<T & Relations> {
    filter = produceSoftDeleteFilter(filter, {
      id,
    });

    //As parent method findById have filter: FilterExcludingWhere<T>
    //so we need add check here.
    const entityToRemove = await super.findOne(filter, options);
    if (entityToRemove) {
      // Now call super
      return super.findById(id, filter, options);
    } else {
      throw new HttpErrors.NotFound(ErrorKeys.EntityNotFound);
    }
  }

  //find by Id including soft deleted record
  findByIdIncludeSoftDelete(
    id: ID,
    filter?: Filter<T>,
    options?: Options,
  ): Promise<T & Relations> {
    return super.findById(id, filter, options);
  }

  updateAll(
    data: DataObject<T>,
    where?: Where<T>,
    options?: Options,
  ): Promise<Count> {
    where = produceSoftDeleteWhere(where);

    // Now call super
    return super.updateAll(data, where, options);
  }

  count(where?: Where<T>, options?: Options): Promise<Count> {
    // Filter out soft deleted entries
    where = produceSoftDeleteWhere(where);

    // Now call super
    return super.count(where, options);
  }

  async delete(entity: T, options?: Options): Promise<void> {
    // Do soft delete, no hard delete allowed
    (entity as SoftDeleteEntity).deleted = true;
    (entity as SoftDeleteEntity).deletedOn = new Date();
    (entity as SoftDeleteEntity).deletedBy = await this.getUserId();
    return super.update(entity, options);
  }

  async deleteAll(where?: Where<T>, options?: Options): Promise<Count> {
    // Do soft delete, no hard delete allowed
    return this.updateAll(
      {
        deleted: true,
        deletedOn: new Date(),
        deletedBy: await this.getUserId(),
      } as DataObject<T>,
      where,
      options,
    );
  }

  async deleteById(id: ID, options?: Options): Promise<void> {
    // Do soft delete, no hard delete allowed
    return super.updateById(
      id,
      {
        deleted: true,
        deletedOn: new Date(),
        deletedBy: await this.getUserId(),
      } as DataObject<T>,
      options,
    );
  }

  /**
   * Method to perform hard delete of entries. Take caution.
   * @param entity
   * @param options
   */
  deleteHard(entity: T, options?: Options): Promise<void> {
    // Do hard delete
    return super.deleteById(entity.getId(), options);
  }

  /**
   * Method to perform hard delete of entries. Take caution.
   * @param entity
   * @param options
   */
  deleteAllHard(where?: Where<T>, options?: Options): Promise<Count> {
    // Do hard delete
    return super.deleteAll(where, options);
  }

  /**
   * Method to perform hard delete of entries. Take caution.
   * @param entity
   * @param options
   */
  deleteByIdHard(id: ID, options?: Options): Promise<void> {
    // Do hard delete
    return super.deleteById(id, options);
  }

  private async getUserId(options?: Options): Promise<string | undefined> {
    if (!this.getCurrentUser) {
      return undefined;
    }
    let currentUser = await this.getCurrentUser();
    currentUser = currentUser ?? options?.currentUser;
    if (!currentUser || !currentUser.id) {
      return undefined;
    }
    return currentUser.id.toString();
  }
}
