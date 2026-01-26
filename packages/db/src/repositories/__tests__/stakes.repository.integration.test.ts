import { asc, desc, eq } from "drizzle-orm";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "vitest";

import {
  BlockHashCoder,
  BlockchainAddressAsU8A,
  TxHashCoder,
} from "../../coders/index.js";
import * as schema from "../../schema/indexing/defs.js";
import { dropAllSchemas } from "../../utils/drop-all-schemas.js";
import { pushSchema } from "../../utils/push-schema.js";
import {
  type RelockArgs,
  type StakeArgs,
  StakesRepository,
  type UnstakeArgs,
  type WithdrawArgs,
} from "../stakes.js";
import { db } from "./db.js";

function randomWallet(): `0x${string}` {
  return randomHex(20);
}

function randomHex(sizeInBytes: number): `0x${string}` {
  const bytes = new Uint8Array(sizeInBytes);
  crypto.getRandomValues(bytes);
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function makeTx(seed: number) {
  const blockTimestamp = new Date(Date.now() + seed * 1000);
  return {
    blockTimestamp,
    txHash: randomHex(32),
    logIndex: seed,
    blockNumber: BigInt(1000 + seed),
    blockHash: randomHex(32),
  };
}

describe("StakesRepository integration", () => {
  beforeAll(async () => {
    await dropAllSchemas(db);
    const { apply } = await pushSchema(db);
    await apply();
  });

  let repo: StakesRepository;
  let wallet: string;

  beforeEach(async () => {
    repo = new StakesRepository(db);
    wallet = randomWallet();
  });

  afterEach(async () => {
    // Clean tables used by this suite to keep tests isolated
    await db.delete(schema.stakeChanges);
    await db.delete(schema.stakes);
  });

  test("stake() inserts stake and journal row; idempotent on conflict", async () => {
    const seed = 1;
    const tx = makeTx(seed);
    const stakeArgs: StakeArgs = {
      stakeId: 1n,
      wallet,
      amount: 1000n,
      duration: 3600,
      ...tx,
    };

    const created = await repo.stake(stakeArgs);
    expect(created?.id).toBe(1n);
    expect(created?.amount).toBe(1000n);
    expect(created?.canUnstakeAfter.getTime()).toBe(
      tx.blockTimestamp.getTime() + 3600 * 1000,
    );

    // Verify change row
    const [change] = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 1n));
    expect(change?.deltaAmount).toBe(1000n);
    expect(change?.kind).toBe("stake");
    expect(change?.wallet).toEqual(BlockchainAddressAsU8A.encode(wallet));
    expect(change?.walletAddress).toBe(wallet.toLowerCase());
    expect(change?.txHash).toEqual(TxHashCoder.encode(tx.txHash));
    expect(change?.blockHash).toEqual(BlockHashCoder.encode(tx.blockHash));

    // Idempotent insert (same stakeId) should return undefined and not create another change
    const again = await repo.stake(stakeArgs);
    expect(again).toBeUndefined();
    const changes = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 1n));
    expect(changes.length).toBe(1);
  });

  test("unstake() routes to partial vs full based on remainingAmount", async () => {
    // Seed initial stake
    const tx0 = makeTx(10);
    await repo.stake({
      stakeId: 2n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...tx0,
    });

    // Partial unstake: remaining 700 (delta -300)
    const tx1 = makeTx(11);
    const partialArgs: UnstakeArgs = {
      stakeId: 2n,
      remainingAmount: 700n,
      canWithdrawAfter: new Date(tx1.blockTimestamp.getTime() + 60000),
      ...tx1,
    };
    await repo.unstake(partialArgs);

    let [snapshot] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 2n));
    expect(snapshot?.amount).toBe(700n);
    expect(snapshot?.canWithdrawAfter?.getTime()).toBe(
      partialArgs.canWithdrawAfter.getTime(),
    );

    const [change1] = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 2n))
      .orderBy(desc(schema.stakeChanges.createdAt))
      .limit(1);
    expect(change1?.deltaAmount).toBe(-300n);
    expect(change1?.kind).toBe("unstake");

    // Full unstake: remaining equals current amount (700 -> 700), delta 0
    const tx2 = makeTx(12);
    const fullArgs: UnstakeArgs = {
      stakeId: 2n,
      remainingAmount: 700n,
      canWithdrawAfter: new Date(tx2.blockTimestamp.getTime() + 60000),
      ...tx2,
    };
    await repo.unstake(fullArgs);

    [snapshot] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 2n));
    expect(snapshot?.unstakedAt).toEqual(tx2.blockTimestamp);
    expect(snapshot?.canWithdrawAfter?.getTime()).toBe(
      fullArgs.canWithdrawAfter.getTime(),
    );

    const rows = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 2n))
      .orderBy(asc(schema.stakeChanges.createdAt));
    expect(rows.length).toBe(3); // initial stake + partial + full
    expect(rows[rows.length - 1]?.deltaAmount).toBe(0n);
    expect(rows[rows.length - 1]?.kind).toBe("unstake");
  });

  test("unstake() is noop when stake id not found", async () => {
    const tx = makeTx(100);
    const args: UnstakeArgs = {
      stakeId: 999n,
      remainingAmount: 0n,
      canWithdrawAfter: new Date(tx.blockTimestamp.getTime() + 60000),
      ...tx,
    };

    await expect(repo.unstake(args)).resolves.toBeUndefined();

    const changes = await db
      .select({ id: schema.stakeChanges.id })
      .from(schema.stakeChanges);
    expect(changes.length).toBe(0);

    const stakesRows = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 999n));
    expect(stakesRows.length).toBe(0);
  });

  test("partialUnstake() throws error when deltaAmount >= 0", async () => {
    // Create a stake first
    const stakeTx = makeTx(200);
    const stakeArgs: StakeArgs = {
      stakeId: 5n,
      wallet,
      amount: 1000n,
      duration: 300,
      ...stakeTx,
    };
    await repo.stake(stakeArgs);

    // Test the partialUnstake method directly with invalid parameters
    // remainingAmount = 1000, amountStaked = 1000, so deltaAmount = 0
    const unstakeTx = makeTx(201);
    const unstakeArgs: UnstakeArgs = {
      stakeId: 5n,
      remainingAmount: 1000n, // Same as staked amount, deltaAmount = 0
      canWithdrawAfter: new Date(unstakeTx.blockTimestamp.getTime() + 60000),
      ...unstakeTx,
    };

    // Call partialUnstake directly to test the validation
    await expect(repo.partialUnstake(unstakeArgs, 1000n)).rejects.toThrow(
      "Cannot unstake more than staked amount",
    );
  });

  test("partialUnstake() skips silently when stake not found (idempotent)", async () => {
    const unstakeTx = makeTx(301);
    const unstakeArgs: UnstakeArgs = {
      stakeId: 6n,
      remainingAmount: 300n, // Valid partial unstake amount (300 < 1000, so deltaAmount = -700 < 0)
      canWithdrawAfter: new Date(unstakeTx.blockTimestamp.getTime() + 60000),
      ...unstakeTx,
    };

    // Should not throw - returns silently for idempotency
    await expect(
      repo.partialUnstake(unstakeArgs, 500n),
    ).resolves.toBeUndefined();
  });

  test("fullUnstake() throws error when deltaAmount !== 0", async () => {
    // Test with remainingAmount != amountStaked to trigger deltaAmount !== 0 validation
    const unstakeTx = makeTx(401);
    const unstakeArgs: UnstakeArgs = {
      stakeId: 7n,
      remainingAmount: 0n, // Full unstake
      canWithdrawAfter: new Date(unstakeTx.blockTimestamp.getTime() + 60000),
      ...unstakeTx,
    };

    // Call fullUnstake with amountStaked = 500, but remainingAmount = 0
    // This results in deltaAmount = 0 - 500 = -500, which is !== 0
    await expect(repo.fullUnstake(unstakeArgs, 500n)).rejects.toThrow(
      "Should unstake exactly the staked amount",
    );
  });

  test("fullUnstake() skips silently when stake not found (idempotent)", async () => {
    // Test with non-existent stake ID
    const unstakeTx = makeTx(501);
    const unstakeArgs: UnstakeArgs = {
      stakeId: 999n, // Non-existent stake ID
      remainingAmount: 0n, // Full unstake
      canWithdrawAfter: new Date(unstakeTx.blockTimestamp.getTime() + 60000),
      ...unstakeTx,
    };

    // Call fullUnstake with non-existent stake ID
    // deltaAmount = 0 - 0 = 0, which passes the first validation
    // The update affects 0 rows - now returns silently for idempotency
    await expect(repo.fullUnstake(unstakeArgs, 0n)).resolves.toBeUndefined();
  });

  test("fullRelock() throws error when updatedAmount !== 0", async () => {
    // Test with updatedAmount != 0 to trigger validation
    const relockTx = makeTx(600);
    const relockArgs: RelockArgs = {
      stakeId: 9n,
      updatedAmount: 500n, // Non-zero amount, should fail validation
      ...relockTx,
    };

    // Call fullRelock with updatedAmount = 500, which is !== 0
    await expect(repo.fullRelock(relockArgs)).rejects.toThrow(
      "Should relock exactly the staked amount",
    );
  });

  test("fullRelock() skips silently when stake not found (idempotent)", async () => {
    // Test with non-existent stake ID
    const relockTx = makeTx(700);
    const relockArgs: RelockArgs = {
      stakeId: 999n, // Non-existent stake ID
      updatedAmount: 0n, // Valid for full relock
      ...relockTx,
    };

    // Call fullRelock with non-existent stake ID
    // updatedAmount = 0, which passes the first validation
    // The update affects 0 rows - now returns silently for idempotency
    await expect(repo.fullRelock(relockArgs)).resolves.toBeUndefined();
  });

  test("partialRelock() throws error when updatedAmount <= 0", async () => {
    // Test with updatedAmount <= 0 to trigger validation
    const relockTx = makeTx(800);
    const relockArgs: RelockArgs = {
      stakeId: 10n,
      updatedAmount: 0n, // Zero amount, should fail validation
      ...relockTx,
    };

    // Call partialRelock with updatedAmount = 0, which is <= 0
    await expect(repo.partialRelock(relockArgs)).rejects.toThrow(
      "Should relock non-zero amount",
    );
  });

  test("partialRelock() skips silently when stake not found (idempotent)", async () => {
    // Test with non-existent stake ID
    const relockTx = makeTx(900);
    const relockArgs: RelockArgs = {
      stakeId: 999n, // Non-existent stake ID
      updatedAmount: 500n, // Valid amount for partial relock
      ...relockTx,
    };

    // Call partialRelock with non-existent stake ID
    // updatedAmount = 500, which passes the first validation
    // The select for update finds no rows - now returns silently for idempotency
    await expect(repo.partialRelock(relockArgs)).resolves.toBeUndefined();
  });

  test("withdraw() skips silently when stake not found (idempotent)", async () => {
    // Test with non-existent stake ID
    const withdrawTx = makeTx(1000);
    const withdrawArgs: WithdrawArgs = {
      stakeId: 999n, // Non-existent stake ID
      ...withdrawTx,
    };

    // Call withdraw with non-existent stake ID
    // The update affects 0 rows - now returns silently for idempotency
    await expect(repo.withdraw(withdrawArgs)).resolves.toBeUndefined();
  });

  test("relock() supports full and partial flows", async () => {
    // Seed stake
    const tx0 = makeTx(20);
    await repo.stake({
      stakeId: 3n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...tx0,
    });

    // Full relock: updatedAmount 0, sets relockedAt & unstakedAt, delta -amount
    const tx1 = makeTx(21);
    const relockFull: RelockArgs = { stakeId: 3n, updatedAmount: 0n, ...tx1 };
    await repo.relock(relockFull);
    let [snap] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 3n));
    expect(snap?.relockedAt).toEqual(tx1.blockTimestamp);
    expect(snap?.unstakedAt).toEqual(tx1.blockTimestamp);
    const [chg] = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 3n))
      .orderBy(desc(schema.stakeChanges.createdAt))
      .limit(1);
    expect(chg?.kind).toBe("relock");
    expect(chg?.deltaAmount).toBe(-1000n);

    // Partial relock: set updatedAmount and write negative delta
    const tx2 = makeTx(22);
    await db
      .update(schema.stakes)
      .set({ amount: 800n, relockedAt: null, unstakedAt: null })
      .where(eq(schema.stakes.id, 3n));
    const relockPartial: RelockArgs = {
      stakeId: 3n,
      updatedAmount: 500n,
      ...tx2,
    };
    await repo.relock(relockPartial);
    [snap] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 3n));
    expect(snap?.relockedAt).toEqual(tx2.blockTimestamp);
    expect(snap?.unstakedAt).toEqual(tx2.blockTimestamp);
    expect(snap?.amount).toBe(500n);
    const [chg2] = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 3n))
      .orderBy(desc(schema.stakeChanges.createdAt))
      .limit(1);
    expect(chg2?.kind).toBe("relock");
    expect(chg2?.deltaAmount).toBe(500n - 800n);
  });

  test("withdraw() marks withdrawn and appends journal", async () => {
    const tx0 = makeTx(30);
    await repo.stake({
      stakeId: 4n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...tx0,
    });
    const tx1 = makeTx(31);
    const args: WithdrawArgs = { stakeId: 4n, ...tx1 };
    await repo.withdraw(args);
    const [row] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 4n));
    expect(row?.withdrawnAt).toEqual(tx1.blockTimestamp);
    const [chg] = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 4n))
      .orderBy(desc(schema.stakeChanges.createdAt))
      .limit(1);
    expect(chg?.kind).toBe("withdraw");
    expect(chg?.deltaAmount).toBe(0n);
  });

  test("findById() returns current snapshot or undefined", async () => {
    const res1 = await repo.findById(999n);
    expect(res1).toBeUndefined();
    const tx0 = makeTx(40);
    await repo.stake({
      stakeId: 5n,
      wallet,
      amount: 123n,
      duration: 10,
      ...tx0,
    });
    const res2 = await repo.findById(5n);
    expect(res2?.amount).toBe(123n);
  });

  test("allStaked() paginates only active (unstakedAt IS NULL)", async () => {
    // Create three stakes
    const base = new Date();
    await repo.stake({
      stakeId: 10n,
      wallet,
      amount: 100n,
      duration: 10,
      ...makeTx(50),
    });
    await repo.stake({
      stakeId: 11n,
      wallet,
      amount: 200n,
      duration: 10,
      ...makeTx(51),
    });
    await repo.stake({
      stakeId: 12n,
      wallet,
      amount: 300n,
      duration: 10,
      ...makeTx(52),
    });
    // Mark one as unstaked
    await db
      .update(schema.stakes)
      .set({ unstakedAt: base })
      .where(eq(schema.stakes.id, 11n));

    const page1 = await repo.allStaked(undefined, 2);
    expect(page1.map((r) => r.id)).toEqual([10n, 12n]);
    const page2 = await repo.allStaked(10n, 2);
    expect(page2.map((r) => r.id)).toEqual([12n]);
  });

  // True idempotency tests - verify that calling an operation twice
  // results in exactly one state change and one journal entry

  test("fullUnstake() is idempotent - second call is noop", async () => {
    // Set up a stake
    const stakeTx = makeTx(1100);
    await repo.stake({
      stakeId: 100n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...stakeTx,
    });

    // First call succeeds
    const unstakeTx = makeTx(1101);
    const unstakeArgs: UnstakeArgs = {
      stakeId: 100n,
      remainingAmount: 1000n, // Full unstake (remainingAmount equals staked amount)
      canWithdrawAfter: new Date(unstakeTx.blockTimestamp.getTime() + 60000),
      ...unstakeTx,
    };
    await repo.fullUnstake(unstakeArgs, 1000n);

    const changesAfterFirst = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 100n));

    // Second call - should be noop (stake already has unstakedAt set)
    await repo.fullUnstake(unstakeArgs, 1000n);

    const changesAfterSecond = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 100n));

    // No duplicate journal entry
    expect(changesAfterSecond.length).toBe(changesAfterFirst.length);
    // Should have exactly 2 entries: initial stake + full unstake
    expect(changesAfterSecond.length).toBe(2);
  });

  test("fullRelock() is idempotent - second call is noop", async () => {
    // Set up a stake
    const stakeTx = makeTx(1200);
    await repo.stake({
      stakeId: 101n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...stakeTx,
    });

    // First call succeeds
    const relockTx = makeTx(1201);
    const relockArgs: RelockArgs = {
      stakeId: 101n,
      updatedAmount: 0n, // Full relock
      ...relockTx,
    };
    await repo.fullRelock(relockArgs);

    const changesAfterFirst = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 101n));

    // Verify first call worked
    const [stakeAfterFirst] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 101n));
    expect(stakeAfterFirst?.relockedAt).toEqual(relockTx.blockTimestamp);

    // Second call - should be noop (stake already has relockedAt set)
    await repo.fullRelock(relockArgs);

    const changesAfterSecond = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 101n));

    // No duplicate journal entry
    expect(changesAfterSecond.length).toBe(changesAfterFirst.length);
    // Should have exactly 2 entries: initial stake + full relock
    expect(changesAfterSecond.length).toBe(2);
  });

  test("withdraw() is idempotent - second call is noop", async () => {
    // Set up a stake
    const stakeTx = makeTx(1300);
    await repo.stake({
      stakeId: 102n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...stakeTx,
    });

    // First call succeeds
    const withdrawTx = makeTx(1301);
    const withdrawArgs: WithdrawArgs = {
      stakeId: 102n,
      ...withdrawTx,
    };
    await repo.withdraw(withdrawArgs);

    const changesAfterFirst = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 102n));

    // Verify first call worked
    const [stakeAfterFirst] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 102n));
    expect(stakeAfterFirst?.withdrawnAt).toEqual(withdrawTx.blockTimestamp);

    // Second call - should be noop (stake already has withdrawnAt set)
    await repo.withdraw(withdrawArgs);

    const changesAfterSecond = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 102n));

    // No duplicate journal entry
    expect(changesAfterSecond.length).toBe(changesAfterFirst.length);
    // Should have exactly 2 entries: initial stake + withdraw
    expect(changesAfterSecond.length).toBe(2);
  });

  test("partialRelock() is idempotent - second call is noop when already relocked", async () => {
    // Set up a stake
    const stakeTx = makeTx(1400);
    await repo.stake({
      stakeId: 103n,
      wallet,
      amount: 1000n,
      duration: 60,
      ...stakeTx,
    });

    // First call succeeds
    const relockTx = makeTx(1401);
    const relockArgs: RelockArgs = {
      stakeId: 103n,
      updatedAmount: 500n, // Partial relock
      ...relockTx,
    };
    await repo.partialRelock(relockArgs);

    const changesAfterFirst = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 103n));

    // Verify first call worked
    const [stakeAfterFirst] = await db
      .select()
      .from(schema.stakes)
      .where(eq(schema.stakes.id, 103n));
    expect(stakeAfterFirst?.relockedAt).toEqual(relockTx.blockTimestamp);
    expect(stakeAfterFirst?.amount).toBe(500n);

    // Second call - should be noop (stake already has relockedAt set)
    await repo.partialRelock(relockArgs);

    const changesAfterSecond = await db
      .select()
      .from(schema.stakeChanges)
      .where(eq(schema.stakeChanges.stakeId, 103n));

    // No duplicate journal entry
    expect(changesAfterSecond.length).toBe(changesAfterFirst.length);
    // Should have exactly 2 entries: initial stake + partial relock
    expect(changesAfterSecond.length).toBe(2);
  });
});
