import { db } from "@/database/db.js";
import { objectIndex } from "@/database/schema/syncing/defs.js";
import { SyncDataType } from "@/types/index.js";

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
}

export const objectIndexRepository = new ObjectIndexRepository();