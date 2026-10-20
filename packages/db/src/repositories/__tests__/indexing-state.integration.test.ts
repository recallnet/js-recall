import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import { indexingCheckpoints } from "../../schema/indexing/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import { IndexingStateRepository } from "../indexing-state.js";
import { db } from "./db.js";

beforeAll(async () => {
  await dropAllSchemas(db);
  const { apply } = await pushSchema(db);
  await apply();
});
beforeEach(async () => {
  await db.delete(indexingCheckpoints);
});

describe("IndexingStateRepository", () => {
  it("persists scan progress across repository instances, including empty batches", async () => {
    await new IndexingStateRepository(db).runBatch("events", async () => ({
      nextBlock: 1234,
    }));
    expect(
      await new IndexingStateRepository(db).getCheckpoint("events"),
    ).toMatchObject({ nextBlock: 1234, updatedAt: expect.any(Date) });
  });

  it("rolls back domain writes and progress on failure and releases the lock", async () => {
    const repository = new IndexingStateRepository(db);
    await expect(
      repository.runBatch("events", async (tx) => {
        await tx
          .insert(indexingCheckpoints)
          .values({ key: "domain-write", nextBlock: 100 });
        throw new Error("interrupted");
      }),
    ).rejects.toThrow("interrupted");
    expect(await repository.getCheckpoint("domain-write")).toBeUndefined();
    expect(await repository.getCheckpoint("events")).toBeUndefined();
    expect(
      await repository.runBatch("events", async () => ({ nextBlock: 100 })),
    ).toEqual({ nextBlock: 100 });
  });

  it("excludes overlapping workers but allows the other indexer to run", async () => {
    const first = new IndexingStateRepository(db);
    const second = new IndexingStateRepository(db);
    let entered!: () => void;
    let release!: () => void;
    const acquired = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = first.runBatch("events", async () => {
      entered();
      await hold;
      return { nextBlock: 100 };
    });
    try {
      await acquired;
      expect(
        await second.runBatch("events", async () => {
          throw new Error("must not run");
        }),
      ).toBeUndefined();
      expect(
        await second.runBatch("transactions", async () => ({ nextBlock: 200 })),
      ).toEqual({ nextBlock: 200 });
    } finally {
      release();
      await pending;
    }
    expect(
      await second.runBatch("events", async (_tx, nextBlock) => ({
        nextBlock: nextBlock! + 1,
      })),
    ).toEqual({ nextBlock: 101 });
  });

  it("rejects backward checkpoint updates without losing committed progress", async () => {
    const repository = new IndexingStateRepository(db);
    await repository.runBatch("events", async () => ({ nextBlock: 500 }));
    await expect(
      repository.runBatch("events", async () => ({ nextBlock: 499 })),
    ).rejects.toThrow("Invalid indexing checkpoint");
    expect(await repository.getCheckpoint("events")).toMatchObject({
      nextBlock: 500,
    });
  });
});
