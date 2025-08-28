import { and, desc, eq } from "drizzle-orm";

import config from "@/config/index.js";
import { db } from "@/database/db.js";
import { indexingEvents } from "@/database/schema/indexing/defs.js";
import { EventData } from "@/indexing/blockchain-types.js";

export class EventsRepository {
  readonly #db: typeof db;

  constructor(database: typeof db = db) {
    this.#db = database;
  }

  async isEventPresent(
    blockNumber: bigint,
    transactionHash: string,
    logIndex: number,
  ): Promise<boolean> {
    const rows = await this.#db
      .select({ id: indexingEvents.blockNumber })
      .from(indexingEvents)
      .where(
        and(
          eq(indexingEvents.blockNumber, blockNumber),
          eq(indexingEvents.transactionHash, transactionHash.toLowerCase()),
          eq(indexingEvents.logIndex, logIndex),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async save(event: EventData): Promise<boolean> {
    const rows = await this.#db
      .insert(indexingEvents)
      .values({
        id: crypto.randomUUID(),
        rawEventData: event.raw,
        type: event.type,
        blockNumber: event.blockNumber,
        blockHash: event.blockHash.toLowerCase(),
        blockTimestamp: event.blockTimestamp,
        transactionHash: event.transactionHash.toLowerCase(),
        logIndex: event.logIndex,
        createdAt: event.createdAt,
      })
      .onConflictDoNothing()
      .returning({ id: indexingEvents.id });
    return rows.length > 0;
  }

  async lastBlockNumber(): Promise<bigint> {
    const [row] = await this.#db
      .select({ blockNumber: indexingEvents.blockNumber })
      .from(indexingEvents)
      .orderBy(desc(indexingEvents.blockNumber))
      .limit(1);

    const lastBlockNumber = row?.blockNumber ?? config.stakingIndex.startBlock;
    return BigInt(lastBlockNumber);
  }
}
