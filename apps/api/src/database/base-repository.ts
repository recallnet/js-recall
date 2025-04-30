import { DatabaseConnection } from "@/database/connection.js";

/**
 * Base Repository
 * Provides common database operations for entities
 */
export abstract class BaseRepository {
  protected dbConn: DatabaseConnection;

  constructor() {
    this.dbConn = DatabaseConnection.getInstance();
  }
}
