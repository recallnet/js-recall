import { DatabaseConnection } from './connection';
import { DatabaseRow } from './types';
import { PoolClient } from 'pg';

/**
 * Base Repository
 * Provides common database operations for entities
 */
export abstract class BaseRepository<T> {
  protected db: DatabaseConnection;
  protected tableName: string;

  constructor(tableName: string) {
    this.db = DatabaseConnection.getInstance();
    this.tableName = tableName;
  }

  /**
   * Convert snake_case database fields to camelCase
   * @param entity Entity with snake_case keys
   */
  protected toCamelCase(entity: DatabaseRow): DatabaseRow {
    if (!entity) return {} as DatabaseRow;

    const result: DatabaseRow = {};

    for (const key in entity) {
      if (Object.prototype.hasOwnProperty.call(entity, key)) {
        // Convert snake_case to camelCase
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        result[camelKey] = entity[key];
      }
    }

    return result;
  }

  /**
   * Convert camelCase object fields to snake_case
   * @param entity Entity with camelCase keys
   */
  protected toSnakeCase(entity: DatabaseRow): DatabaseRow {
    if (!entity) return {} as DatabaseRow;

    const result: DatabaseRow = {};

    for (const key in entity) {
      if (Object.prototype.hasOwnProperty.call(entity, key)) {
        // Convert camelCase to snake_case
        const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        result[snakeKey] = entity[key];
      }
    }

    return result;
  }

  /**
   * Find an entity by its ID
   * @param id Entity ID
   * @param client Optional database client for transactions
   */
  async findById(id: string | number, client?: PoolClient): Promise<T | null> {
    try {
      const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
      const values = [id];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rows.length > 0 ? this.mapToEntity(this.toCamelCase(result.rows[0])) : null;
    } catch (error) {
      console.error(`[${this.tableName}Repository] Error in findById:`, error);
      throw error;
    }
  }

  /**
   * Find all entities
   * @param client Optional database client for transactions
   */
  async findAll(client?: PoolClient): Promise<T[]> {
    try {
      const query = `SELECT * FROM ${this.tableName}`;

      const result = client ? await client.query(query) : await this.db.query(query);

      return result.rows.map((row: DatabaseRow) => this.mapToEntity(this.toCamelCase(row)));
    } catch (error) {
      console.error(`[${this.tableName}Repository] Error in findAll:`, error);
      throw error;
    }
  }

  /**
   * Delete an entity by its ID
   * @param id Entity ID
   * @param client Optional database client for transactions
   */
  async delete(id: string | number, client?: PoolClient): Promise<boolean> {
    try {
      const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
      const values = [id];

      const result = client
        ? await client.query(query, values)
        : await this.db.query(query, values);

      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error(`[${this.tableName}Repository] Error in delete:`, error);
      throw error;
    }
  }

  /**
   * Count all entities in the table
   * @param client Optional database client for transactions
   */
  async count(client?: PoolClient): Promise<number> {
    try {
      const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;

      const result = client ? await client.query(query) : await this.db.query(query);

      return parseInt(result.rows[0].count, 10);
    } catch (error) {
      console.error(`[${this.tableName}Repository] Error in count:`, error);
      throw error;
    }
  }

  /**
   * Abstract method to map database row to entity
   * Must be implemented by derived classes
   * @param data Data from database with camelCase keys
   */
  protected abstract mapToEntity(data: DatabaseRow): T;
}
