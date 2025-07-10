import { and, count, desc, eq } from "drizzle-orm";

import { db } from "@/database/db.js";
import { objectIndex } from "@/database/schema/syncing/defs.js";
import { createTimedRepositoryFunction } from "@/lib/repository-timing.js";
import { SyncDataType } from "@/types/index.js";

/**
 * Insert multiple object index entries
 */
async function insertObjectIndexEntriesImpl(
  entries: Array<{
    id: string;
    competitionId: string | null;
    agentId: string;
    dataType: SyncDataType;
    data: string;
    sizeBytes: number;
    metadata: unknown;
    eventTimestamp: Date;
    createdAt: Date;
  }>,
): Promise<void> {
  if (entries.length === 0) return;
  await db.insert(objectIndex).values(entries);
}

/**
 * Insert a single object index entry
 */
async function insertObjectIndexEntryImpl(entry: {
  id: string;
  competitionId: string | null;
  agentId: string;
  dataType: SyncDataType;
  data: string;
  sizeBytes: number;
  metadata: unknown;
  eventTimestamp: Date;
  createdAt: Date;
}): Promise<void> {
  await db.insert(objectIndex).values(entry);
}

/**
 * Count object index entries
 */
async function countObjectIndexImpl(filters?: {
  competitionId?: string;
  agentId?: string;
  dataType?: SyncDataType;
}): Promise<number> {
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

  const query = db.select({ count: count() }).from(objectIndex);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const result = await query;
  return result[0]?.count ?? 0;
}

/**
 * Get all object index entries with optional filters
 */
async function getAllObjectIndexImpl(
  filters?: {
    competitionId?: string;
    agentId?: string;
    dataType?: SyncDataType;
  },
  limit = 100,
  offset = 0,
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

// =============================================================================
// EXPORTED REPOSITORY FUNCTIONS WITH TIMING
// =============================================================================

export const insertObjectIndexEntries = createTimedRepositoryFunction(
  insertObjectIndexEntriesImpl,
  "ObjectIndexRepository",
  "insertObjectIndexEntries",
);

export const insertObjectIndexEntry = createTimedRepositoryFunction(
  insertObjectIndexEntryImpl,
  "ObjectIndexRepository",
  "insertObjectIndexEntry",
);

export const countObjectIndex = createTimedRepositoryFunction(
  countObjectIndexImpl,
  "ObjectIndexRepository",
  "countObjectIndex",
);

export const getAllObjectIndex = createTimedRepositoryFunction(
  getAllObjectIndexImpl,
  "ObjectIndexRepository",
  "getAllObjectIndex",
);

// Legacy class-based interface for backward compatibility
export class ObjectIndexRepository {
  async insertObjectIndexEntries(
    entries: Array<{
      id: string;
      competitionId: string | null;
      agentId: string;
      dataType: SyncDataType;
      data: string;
      sizeBytes: number;
      metadata: unknown;
      eventTimestamp: Date;
      createdAt: Date;
    }>,
  ) {
    return insertObjectIndexEntries(entries);
  }

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
    return insertObjectIndexEntry(entry);
  }

  async count(filters?: {
    competitionId?: string;
    agentId?: string;
    dataType?: SyncDataType;
  }) {
    return countObjectIndex(filters);
  }

  async getAll(
    filters?: {
      competitionId?: string;
      agentId?: string;
      dataType?: SyncDataType;
    },
    limit = 100,
    offset = 0,
  ) {
    return getAllObjectIndex(filters, limit, offset);
  }
}

export const objectIndexRepository = new ObjectIndexRepository();
