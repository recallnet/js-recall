// @vitest-environment node
import { NextRequest, type NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { runEvents, runTransactions } = vi.hoisted(() => ({
  runEvents: vi.fn(),
  runTransactions: vi.fn(),
}));
vi.mock("@/lib/services", () => ({
  getEventsIndexingService: () => ({ runOnce: runEvents }),
  getTransactionsIndexingService: () => ({ runOnce: runTransactions }),
}));
vi.mock("@/lib/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-indexing-secret");
  vi.stubEnv("INDEXING_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

const routes = [
  {
    name: "events",
    load: () => import("./index-staking-events/route"),
    run: runEvents,
  },
  {
    name: "transactions",
    load: () => import("./index-staking-transactions/route"),
    run: runTransactions,
  },
];

for (const route of routes) {
  describe(`${route.name} indexing cron`, () => {
    let GET: (request: NextRequest) => Promise<NextResponse>;

    function request(token?: string): NextRequest {
      return new NextRequest(
        `https://example.test/api/cron/index-staking-${route.name}`,
        {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        },
      );
    }

    describe("when enabled", () => {
      beforeEach(async () => {
        ({ GET } = await route.load());
      }, 30_000);

      it.each([undefined, "wrong-secret"])(
        "rejects unauthorized requests (%s)",
        async (token) => {
          expect((await GET(request(token))).status).toBe(401);
          expect(route.run).not.toHaveBeenCalled();
        },
      );

      it("rejects requests when CRON_SECRET is unset", async () => {
        vi.stubEnv("CRON_SECRET", "");
        expect((await GET(request("test-indexing-secret"))).status).toBe(401);
        expect(route.run).not.toHaveBeenCalled();
      });

      it("reports committed scan progress for an authenticated request", async () => {
        route.run.mockResolvedValue({
          status: "limited",
          fromBlock: 100,
          nextBlock: 200,
          archiveHeight: 299,
          lagBlocks: 100,
          batches: 1,
          recordsProcessed: 4,
          durationMs: 10,
        });
        const response = await GET(request("test-indexing-secret"));
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({
          success: true,
          ran: true,
          status: "limited",
          nextBlock: 200,
          lagBlocks: 100,
        });
        expect(route.run).toHaveBeenCalledTimes(1);
        expect(route.run).toHaveBeenCalledWith({ maxBatches: 5 });
      });

      it.each([0, 1])(
        "reports a rate limit after %i committed batches",
        async (batches) => {
          route.run.mockResolvedValue({
            status: "rate_limited",
            batches,
            nextBlock: batches ? 200 : null,
          });
          const response = await GET(request("test-indexing-secret"));
          expect(response.status).toBe(200);
          expect(await response.json()).toMatchObject({
            success: true,
            status: "rate_limited",
            ran: batches > 0,
            nextBlock: batches ? 200 : null,
          });
          expect(route.run).toHaveBeenCalledExactlyOnceWith({ maxBatches: 5 });
        },
      );

      it("reports lock contention without claiming a scan ran", async () => {
        route.run.mockResolvedValue({ status: "locked", batches: 0 });
        expect(
          await (await GET(request("test-indexing-secret"))).json(),
        ).toMatchObject({ status: "locked", ran: false });
      });

      it("returns a failed request when processing fails", async () => {
        route.run.mockRejectedValue(new Error("claim write failed"));
        const response = await GET(request("test-indexing-secret"));
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({
          success: false,
          error: "claim write failed",
        });
      });
    });

    describe.each(["false", "", undefined])(
      "with INDEXING_ENABLED=%s",
      (value) => {
        beforeEach(async () => {
          vi.stubEnv("INDEXING_ENABLED", value);
          ({ GET } = await route.load());
        }, 30_000);

        it("does not index", async () => {
          const response = await GET(request("test-indexing-secret"));
          expect(await response.json()).toMatchObject({
            success: false,
            status: "disabled",
            ran: false,
          });
          expect(route.run).not.toHaveBeenCalled();
        });
      },
    );
  });
}
