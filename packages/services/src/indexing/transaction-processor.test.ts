import pino from "pino";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";

import { TransactionProcessor } from "./transaction-processor.js";

describe("TransactionProcessor failures", () => {
  it("rejects a failed database read so the caller can retry the claim", async () => {
    const repository = mock<ConvictionClaimsRepository>();
    repository.isConvictionClaimPresent.mockRejectedValue(
      new Error("database unavailable"),
    );
    const processor = new TransactionProcessor(
      repository,
      pino({ level: "silent" }),
    );

    await expect(
      processor.processTransaction({
        hash: `0x${"11".repeat(32)}`,
        from: `0x${"22".repeat(20)}`,
        to: `0x${"33".repeat(20)}`,
        input: "0x2ac96e2a",
        blockNumber: 500n,
        blockTimestamp: new Date("2026-01-01T00:00:00Z"),
      }),
    ).rejects.toThrow("database unavailable");
  });

  it("rejects a claim whose block timestamp is missing", async () => {
    const repository = mock<ConvictionClaimsRepository>();
    const processor = new TransactionProcessor(
      repository,
      pino({ level: "silent" }),
    );
    await expect(
      processor.process({
        nextBlock: 501,
        archiveHeight: 501,
        totalExecutionTime: 1,
        data: {
          blocks: [],
          logs: [],
          traces: [],
          transactions: [
            {
              hash: `0x${"11".repeat(32)}`,
              blockNumber: 500,
              input: "0x2ac96e2a",
            },
          ],
        },
      }),
    ).rejects.toThrow("Missing block timestamp");
    expect(repository.saveConvictionClaim).not.toHaveBeenCalled();
  });
});
