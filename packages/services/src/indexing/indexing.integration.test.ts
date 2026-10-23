import {
  HypersyncClient,
  type Log,
  type QueryResponse,
} from "@envio-dev/hypersync-client";
import { drizzle } from "drizzle-orm/node-postgres";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import pino from "pino";
import {
  type Hex,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  parseAbi,
} from "viem";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mock } from "vitest-mock-extended";

import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";
import { EventsRepository } from "@recallnet/db/repositories/indexing-events";
import { IndexingStateRepository } from "@recallnet/db/repositories/indexing-state";
import { RewardsRepository } from "@recallnet/db/repositories/rewards";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import schema from "@recallnet/db/schema";

import { pushSchema } from "../../../db/src/utils/push-schema.js";
import type { BoostAwardService } from "../boost-award.service.js";
import type { CompetitionService } from "../competition.service.js";
import { EventProcessor } from "./event-processor.js";
import { EVENTS } from "./hypersync-query.js";
import { IndexingService } from "./indexing.service.js";
import { TransactionProcessor } from "./transaction-processor.js";

vi.mock("@envio-dev/hypersync-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@envio-dev/hypersync-client")>()),
  HypersyncClient: { new: vi.fn() },
}));

if (!process.env.VITE_DATABASE_URL)
  throw new Error("VITE_DATABASE_URL is required for integration tests");
const adminPool = new Pool({
  connectionString: process.env.VITE_DATABASE_URL,
});
const databaseName = `indexing_test_${randomUUID().replaceAll("-", "")}`;
const databaseUrl = new URL(process.env.VITE_DATABASE_URL);
databaseUrl.pathname = `/${databaseName}`;
const pool = new Pool({ connectionString: databaseUrl.toString() });
const db = drizzle(pool, { schema });
const logger = pino({ level: "silent" });
const client = mock<HypersyncClient>();
const competitions = mock<CompetitionService>();
const boosts = mock<BoostAwardService>();
const state = new IndexingStateRepository(db);
const events = new EventsRepository(db);
const stakes = new StakesRepository(db, logger);
const rewards = new RewardsRepository(db, logger);
const claims = new ConvictionClaimsRepository(db, logger);
const wallet: Hex = "0x1111111111111111111111111111111111111111";
const hash: Hex = `0x${"22".repeat(32)}`;
const root: Hex = `0x${"33".repeat(32)}`;
const timestamp = 1_700_000_000;
const config = {
  stakingContract: wallet,
  rewardsContract: "0x4444444444444444444444444444444444444444",
  convictionClaimsContract: "0x5555555555555555555555555555555555555555",
  eventStartBlock: 100,
  transactionsStartBlock: 100,
  hypersyncUrl: "https://example.test",
  hypersyncBearerToken: "test",
  delayMs: 10,
};

function eventService(): IndexingService {
  return IndexingService.createEventsIndexingService(
    logger,
    new EventProcessor(
      db,
      rewards,
      events,
      stakes,
      boosts,
      competitions,
      logger,
    ),
    config,
    state,
  );
}
function transactionService(): IndexingService {
  return IndexingService.createTransactionsIndexingService(
    logger,
    new TransactionProcessor(claims, logger),
    config,
    state,
  );
}
function response(logs: Log[] = []): QueryResponse {
  return {
    nextBlock: 101,
    archiveHeight: 101,
    totalExecutionTime: 1,
    data: {
      blocks: [{ number: 100, timestamp }],
      logs,
      transactions: [],
      traces: [],
    },
  };
}
function log(
  topics: ReturnType<typeof encodeEventTopics>,
  data: Hex,
  logIndex = 0,
): Log {
  return {
    blockNumber: 100,
    blockHash: hash,
    transactionHash: hash,
    address: wallet,
    logIndex,
    topics: topics.map((topic) => {
      if (Array.isArray(topic)) throw new Error("Expected one topic value");
      return topic;
    }),
    data,
  };
}
function stakeLog(): Log {
  return log(
    encodeEventTopics({ abi: EVENTS.Stake.abi, args: { staker: wallet } }),
    encodeAbiParameters(
      [
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [1n, 1000n, BigInt(timestamp), BigInt(timestamp + 3600)],
    ),
  );
}

beforeAll(async () => {
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  const { apply } = await pushSchema(db);
  await apply();
});
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.mocked(HypersyncClient.new).mockReturnValue(client);
  competitions.getOpenForBoosting.mockResolvedValue([]);
  await db.delete(schema.indexingCheckpoints);
  await db.delete(schema.indexingEvents);
  await db.delete(schema.stakeChanges);
  await db.delete(schema.stakes);
  await db.delete(schema.convictionClaims);
  await db.delete(schema.seasons);
  await db.delete(schema.rewards);
  await db.delete(schema.rewardsRoots);
  await db.delete(schema.competitions);
  await db.delete(schema.users);
});
afterAll(async () => {
  try {
    await pool.end();
    await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  } finally {
    await adminPool.end();
  }
});

describe("Indexing batches with PostgreSQL", () => {
  it("rolls back a stake when recording its intake event fails, then retries once", async () => {
    client.get.mockResolvedValue(response([stakeLog()]));
    const failingAppend = vi
      .spyOn(events, "append")
      .mockRejectedValueOnce(new Error("intake failed"));
    await expect(eventService().runOnce()).rejects.toThrow("intake failed");
    expect(await stakes.findById(1n)).toBeUndefined();
    expect(await events.lastBlockNumber()).toBeUndefined();
    expect(await db.select().from(schema.indexingCheckpoints)).toHaveLength(0);
    failingAppend.mockRestore();
    const result = await eventService().runOnce();
    expect(result).toMatchObject({ status: "caught_up", nextBlock: 101 });
    expect(await stakes.findById(1n)).toMatchObject({ amount: 1000n });
    expect(await db.select().from(schema.stakeChanges)).toHaveLength(1);
    expect(await state.getCheckpoint(result.indexer)).toMatchObject({
      nextBlock: 101,
    });
  });

  it("rolls back an unstake and replays it without changing the amount twice", async () => {
    client.get.mockResolvedValue(response([stakeLog()]));
    await eventService().runOnce();
    const unstake = log(
      encodeEventTopics({ abi: EVENTS.Unstake.abi, args: { staker: wallet } }),
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }, { type: "uint64" }],
        [1n, 400n, BigInt(timestamp + 7200)],
      ),
      1,
    );
    const data = response([unstake]);
    data.nextBlock = 102;
    data.archiveHeight = 102;
    data.data.blocks = [{ number: 101, timestamp }];
    unstake.blockNumber = 101;
    client.get.mockResolvedValue(data);
    const failingAppend = vi
      .spyOn(events, "append")
      .mockRejectedValueOnce(new Error("intake failed"));
    await expect(eventService().runOnce()).rejects.toThrow("intake failed");
    expect(await stakes.findById(1n)).toMatchObject({
      amount: 1000n,
      canWithdrawAfter: null,
    });
    failingAppend.mockRestore();
    await eventService().runOnce();
    // Bootstrap from the last recorded block to exercise a replay of the same log.
    await db.delete(schema.indexingCheckpoints);
    await eventService().runOnce();
    expect(await stakes.findById(1n)).toMatchObject({ amount: 400n });
    expect(await db.select().from(schema.stakeChanges)).toHaveLength(2);
  });

  it("rolls back airdrop claims when a later claim fails, then retries the entire batch", async () => {
    await db.insert(schema.seasons).values({
      startsWithAirdrop: 1,
      name: "Test season",
      startDate: new Date(0),
      endDate: new Date("2030-01-01"),
    });
    const abi = parseAbi([
      "function claim(bytes32[] _proof, address _to, uint256 _amount, uint8 _season, uint256 _duration, bytes _signature)",
    ]);
    const data = response();
    const input = (duration: bigint): Hex =>
      encodeFunctionData({
        abi,
        functionName: "claim",
        args: [[], wallet, 1000n, 1, duration, "0x"],
      });
    data.data.transactions = [
      {
        hash,
        from: wallet,
        to: config.convictionClaimsContract,
        blockNumber: 100,
        input: input(0n),
      },
      {
        hash: root,
        from: wallet,
        to: config.convictionClaimsContract,
        blockNumber: 100,
        input: input(123n),
      },
    ];
    client.get.mockResolvedValue(data);
    await expect(transactionService().runOnce()).rejects.toThrow(
      "invalid duration",
    );
    expect(await claims.isConvictionClaimPresent(hash)).toBe(false);
    expect(await db.select().from(schema.indexingCheckpoints)).toHaveLength(0);
    data.data.transactions[1]!.input = input(31536000n);
    const result = await transactionService().runOnce();
    expect(result).toMatchObject({ status: "caught_up", recordsProcessed: 2 });
    const saved = await claims.getConvictionClaimsByAccount(wallet, 1);
    expect(saved.map((claim) => claim.claimedAmount).sort()).toEqual([
      100n,
      1000n,
    ]);
    await db.delete(schema.indexingCheckpoints);
    await transactionService().runOnce();
    expect(await claims.getConvictionClaimsByAccount(wallet, 1)).toHaveLength(
      2,
    );
  });

  it("commits competition allocation and claim status with their intake events", async () => {
    const competitionId = crypto.randomUUID();
    const userId = crypto.randomUUID();
    await db
      .insert(schema.competitions)
      .values({ id: competitionId, name: "Ended", status: "ended" });
    await db.insert(schema.users).values({ id: userId, walletAddress: wallet });
    await db
      .insert(schema.rewardsRoots)
      .values({ competitionId, rootHash: Buffer.from(root.slice(2), "hex") });
    await db.insert(schema.rewards).values({
      competitionId,
      userId,
      walletAddress: wallet,
      amount: 1000n,
      leafHash: Buffer.from(hash.slice(2), "hex"),
    });
    const allocation = log(
      encodeEventTopics({
        abi: EVENTS.AllocationAdded.abi,
        args: { root, token: wallet },
      }),
      encodeAbiParameters(
        [{ type: "uint256" }, { type: "uint256" }],
        [1000n, BigInt(timestamp)],
      ),
    );
    const claim = log(
      encodeEventTopics({
        abi: EVENTS.RewardClaimed.abi,
        args: { root, user: wallet },
      }),
      encodeAbiParameters([{ type: "uint256" }], [1000n]),
      1,
    );
    client.get.mockResolvedValue(response([allocation, claim]));
    const append = events.append.bind(events);
    const failingAppend = vi
      .spyOn(events, "append")
      .mockImplementation(async (event, tx) => {
        if (event.type === "rewardClaimed") throw new Error("intake failed");
        return append(event, tx);
      });
    await expect(eventService().runOnce()).rejects.toThrow("intake failed");
    expect(
      await rewards.getRewardsRootByCompetition(competitionId),
    ).toMatchObject({ tx: null });
    expect((await db.select().from(schema.rewards))[0]).toMatchObject({
      claimed: false,
    });
    expect(await events.lastBlockNumber()).toBeUndefined();
    failingAppend.mockRestore();
    await eventService().runOnce();
    expect(
      await rewards.getRewardsRootByCompetition(competitionId),
    ).toMatchObject({ tx: hash });
    expect((await db.select().from(schema.rewards))[0]).toMatchObject({
      claimed: true,
    });
  });
});
