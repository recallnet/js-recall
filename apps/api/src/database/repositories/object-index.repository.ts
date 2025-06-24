import { db } from "@/database/db.js";
import { objectIndex } from "@/database/schema/syncing/defs.js";
import { SyncDataType } from "@/types/index.js";
import { and, count, desc, eq } from "drizzle-orm";

export class ObjectIndexRepository {
  /**
   * Insert multiple object index entries
   */
  async insertObjectIndexEntries(entries: Array<{
    id: string;
    competitionId: string | null;
    agentId: string;
    dataType: SyncDataType;
    data: string;
    sizeBytes: number;
    metadata: unknown;
    eventTimestamp: Date;
    createdAt: Date;
  }>) {
    if (entries.length === 0) return;
    await db.insert(objectIndex).values(entries);
  }

  /**
   * Insert a single object index entry
   */
  async insertObjectIndexEntry(entry: {
    id: string;
    competitionId: string | null;
    agentId: string;
    dataType: SyncDataType;
    data: string;
    sizeBytes: number;
    metadata: unknown;
    eventTimestamp: Date;
    createdAt: Date;
  }) {
    await db.insert(objectIndex).values(entry);
  }

  /**
   * Count object index entries
   */
  async count(filters?: {
    competitionId?: string;
    agentId?: string;
    dataType?: SyncDataType;
  }) {
    const conditions = [];
    
    if (filters?.competitionId) {
      conditions.push(eq(objectIndex.competitionId, filters.competitionId));
    }
    if (filters?.agentId) {
      conditions.push(eq(objectIndex.agentId, filters.agentId));
    }
    if (filters?.dataType) {
      conditions.push(eq(objectIndex.dataType, filters.dataType));
    }

    const query = db
      .select({ count: count() })
      .from(objectIndex);

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    const result = await query;
    return result[0]?.count ?? 0;
  }

  /**
   * Get all object index entries with optional filters
   */
  async getAll(
    filters?: {
      competitionId?: string;
      agentId?: string;
      dataType?: SyncDataType;
    },
    limit = 100,
    offset = 0
  ) {
    const conditions = [];
    
    if (filters?.competitionId) {
      conditions.push(eq(objectIndex.competitionId, filters.competitionId));
    }
    if (filters?.agentId) {
      conditions.push(eq(objectIndex.agentId, filters.agentId));
    }
    if (filters?.dataType) {
      conditions.push(eq(objectIndex.dataType, filters.dataType));
    }

    const query = db
      .select()
      .from(objectIndex)
      .orderBy(desc(objectIndex.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      query.where(and(...conditions));
    }

    return await query;
  }
}

export const objectIndexRepository = new ObjectIndexRepository();