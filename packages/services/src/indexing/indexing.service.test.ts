import {
  HypersyncClient,
  type QueryResponse,
} from "@envio-dev/hypersync-client";
import pino from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { IndexingStateRepository } from "@recallnet/db/repositories/indexing-state";
import type { Transaction } from "@recallnet/db/types";

import { IndexingService } from "./indexing.service.js";
import { TransactionProcessor } from "./transaction-processor.js";

vi.mock("@envio-dev/hypersync-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@envio-dev/hypersync-client")>()),
  HypersyncClient: { new: vi.fn() },
}));

const config = {
  stakingContract: "0x1111111111111111111111111111111111111111",
  rewardsContract: "0x2222222222222222222222222222222222222222",
  convictionClaimsContract: "0x3333333333333333333333333333333333333333",
  eventStartBlock: 100,
  transactionsStartBlock: 500,
  hypersyncUrl: "https://example.test",
  hypersyncBearerToken: "test",
  delayMs: 10,
};

function response(nextBlock: number, archiveHeight = nextBlock): QueryResponse {
  return {
    nextBlock,
    archiveHeight,
    totalExecutionTime: 1,
    data: { blocks: [], logs: [], transactions: [], traces: [] },
  };
}

const client = mock<HypersyncClient>();
const processor = mock<TransactionProcessor>();
const state = mock<IndexingStateRepository>();
const tx = mock<Transaction>();
const logger = pino({ level: "silent" });
let checkpoint: number | undefined;

function service(): IndexingService {
  return IndexingService.createTransactionsIndexingService(
    logger,
    processor,
    config,
    state,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  checkpoint = undefined;
  vi.mocked(HypersyncClient.new).mockReturnValue(client);
  processor.lastBlockNumber.mockResolvedValue(0n);
  client.get.mockResolvedValue(response(600));
  state.runBatch.mockImplementation(async (_key, process) => {
    const result = await process(tx, checkpoint);
    checkpoint = result.nextBlock;
    return result;
  });
});
afterEach(() => vi.useRealTimers());

describe("IndexingService", () => {
  it("starts an empty claim index at its configured transaction block", async () => {
    const result = await service().runOnce();
    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 500 }),
    );
    expect(result).toMatchObject({
      status: "caught_up",
      fromBlock: 500,
      nextBlock: 600,
      lagBlocks: 0,
      batches: 1,
    });
  });

  it("replays the last recorded block when bootstrapping existing claims", async () => {
    processor.lastBlockNumber.mockResolvedValue(550n);
    await service().runOnce();
    expect(client.get).toHaveBeenCalledWith(
      expect.objectContaining({ fromBlock: 550 }),
    );
  });

  it("resumes empty scanned ranges across service instances", async () => {
    await service().runOnce();
    client.get.mockResolvedValue(response(700));
    await service().runOnce();
    expect(client.get).toHaveBeenLastCalledWith(
      expect.objectContaining({ fromBlock: 600 }),
    );
    expect(checkpoint).toBe(700);
  });

  it("continues through empty ranges until reaching archive height", async () => {
    client.get
      .mockResolvedValueOnce(response(600, 799))
      .mockResolvedValueOnce(response(800));
    expect(await service().runOnce()).toMatchObject({
      status: "caught_up",
      nextBlock: 800,
      batches: 2,
    });
  });

  it("returns committed progress when its batch limit is reached", async () => {
    client.get.mockResolvedValue(response(600, 1000));
    expect(await service().runOnce({ maxBatches: 1 })).toMatchObject({
      status: "limited",
      nextBlock: 600,
      lagBlocks: 400,
    });
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it("does not query or process while another worker holds the lock", async () => {
    state.runBatch.mockResolvedValue(undefined);
    expect(await service().runOnce()).toMatchObject({
      status: "locked",
      batches: 0,
      nextBlock: null,
    });
    expect(client.get).not.toHaveBeenCalled();
    expect(processor.process).not.toHaveBeenCalled();
  });

  it("does not advance past a processing failure", async () => {
    processor.process.mockRejectedValue(new Error("claim write failed"));
    await expect(service().runOnce()).rejects.toThrow("claim write failed");
    expect(checkpoint).toBeUndefined();
  });

  it("retains earlier committed batches when a following batch fails", async () => {
    client.get
      .mockResolvedValueOnce(response(600, 800))
      .mockRejectedValueOnce(new Error("provider unavailable"));
    await expect(service().runOnce()).rejects.toThrow("provider unavailable");
    expect(checkpoint).toBe(600);
    client.get.mockResolvedValue(response(800));
    expect(await service().runOnce()).toMatchObject({
      fromBlock: 600,
      nextBlock: 800,
      status: "caught_up",
    });
  });

  it("rejects stalled progress below the archive tip", async () => {
    client.get.mockResolvedValue(response(500, 999));
    await expect(service().runOnce()).rejects.toThrow("invalid scan progress");
    expect(checkpoint).toBeUndefined();
  });

  it("accepts an empty scan already at the archive height", async () => {
    checkpoint = 600;
    client.get.mockResolvedValue(response(600, 600));
    expect(await service().runOnce()).toMatchObject({
      status: "caught_up",
      nextBlock: 600,
      lagBlocks: 0,
      batches: 1,
    });
  });

  it("rolls back an unfinished batch when its time budget expires", async () => {
    vi.useFakeTimers();
    processor.process.mockImplementation(async (_response, context) => {
      vi.setSystemTime(Date.now() + 1000);
      context?.checkDeadline();
    });
    expect(await service().runOnce({ maxDurationMs: 500 })).toMatchObject({
      status: "limited",
      batches: 0,
    });
    expect(checkpoint).toBeUndefined();
  });

  it("fails a hanging HyperSync request without committing progress", async () => {
    vi.useFakeTimers();
    client.get.mockReturnValue(new Promise(() => {}));
    const pending = expect(service().runOnce()).rejects.toThrow(
      "HyperSync request timed out",
    );
    await vi.advanceTimersByTimeAsync(10_000);
    await pending;
    expect(checkpoint).toBeUndefined();
    expect(processor.process).not.toHaveBeenCalled();
  });

  it("uses different locks for distinct contract feeds", async () => {
    await service().runOnce();
    await IndexingService.createTransactionsIndexingService(
      logger,
      processor,
      { ...config, convictionClaimsContract: config.stakingContract },
      state,
    ).runOnce();
    expect(state.runBatch.mock.calls[0]?.[0]).not.toBe(
      state.runBatch.mock.calls[1]?.[0],
    );
  });

  it("retries failed continuous passes and closes without hanging", async () => {
    vi.useFakeTimers();
    client.get.mockRejectedValue(new Error("provider unavailable"));
    const worker = service();
    worker.start();
    await vi.advanceTimersByTimeAsync(20);
    expect(client.get.mock.calls.length).toBeGreaterThan(1);
    await worker.close();
    expect(worker.isRunning).toBe(false);
    const calls = client.get.mock.calls.length;
    await vi.advanceTimersByTimeAsync(20);
    expect(client.get).toHaveBeenCalledTimes(calls);
  });
});
