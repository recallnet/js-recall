import type { Logger } from "pino";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockProxy, mock, mockReset } from "vitest-mock-extended";

import { type BoostRepository } from "@recallnet/db/repositories/boost";
import { type CompetitionRepository } from "@recallnet/db/repositories/competition";
import { type UserRepository } from "@recallnet/db/repositories/user";
import { SelectBoostBonus } from "@recallnet/db/schema/boost/types";
import { SelectUser } from "@recallnet/db/schema/core/types";
import { Database, Transaction } from "@recallnet/db/types";

import { BoostBonusService } from "../boost-bonus.service.js";
import { checkForeignKeyViolation } from "../lib/error-utils.js";

const ONE_DAY_MS = 86400000;
const TWO_DAYS_MS = 172800000;
const ONE_MINUTE_MS = 60000;
const MAX_META_LENGTH = 1000;

const createMockUser = (overrides?: Partial<SelectUser>): SelectUser => ({
  id: "user-123",
  walletAddress: "0x0101010101010101010101010101010101010101",
  walletLastVerifiedAt: null,
  embeddedWalletAddress: null,
  privyId: null,
  name: null,
  email: null,
  isSubscribed: false,
  imageUrl: null,
  metadata: null,
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
  ...overrides,
});

const createMockBoostBonus = (
  overrides?: Partial<SelectBoostBonus>,
): SelectBoostBonus => ({
  id: "boost-123",
  userId: "user-123",
  amount: 1000n,
  expiresAt: new Date(Date.now() + ONE_DAY_MS),
  isActive: true,
  revokedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdByAdminId: null,
  meta: null,
  ...overrides,
});

type EnrichedCompetition = Awaited<
  ReturnType<CompetitionRepository["findByStatus"]>
>["competitions"][number];

describe("BoostBonusService", () => {
  let mockDb: MockProxy<Database>;
  let mockBoostRepo: MockProxy<BoostRepository>;
  let mockUserRepo: MockProxy<UserRepository>;
  let mockCompetitionRepo: MockProxy<CompetitionRepository>;
  let mockLogger: MockProxy<Logger>;
  let service: BoostBonusService;

  const testWallet = "0x0101010101010101010101010101010101010101";
  const testUserId = "user-123";
  const testBoostBonusId = "boost-123";

  const setupMockTransaction = () => {
    mockDb.transaction.mockImplementation(
      async (callback: (tx: Transaction) => Promise<unknown>) =>
        callback("mock-tx" as unknown as Transaction),
    );
  };

  const setupBasicBoostMocks = (amount: bigint, expiresAt: Date) => {
    setupMockTransaction();
    mockUserRepo.findByWalletAddress.mockResolvedValue(
      createMockUser({ id: testUserId, walletAddress: testWallet }),
    );
    mockBoostRepo.createBoostBonus.mockResolvedValue(
      createMockBoostBonus({
        id: testBoostBonusId,
        userId: testUserId,
        amount,
        expiresAt,
      }),
    );
  };

  const setupEmptyCompetitions = () => {
    mockCompetitionRepo.findByStatus.mockResolvedValue({
      competitions: [],
      total: 0,
    });
  };

  const setupCompetition = (
    id: string,
    status: "active" | "pending",
    boostStartDate: Date,
    boostEndDate: Date,
  ) =>
    mock<EnrichedCompetition>({
      id,
      status,
      boostStartDate,
      boostEndDate,
      competitionId: id,
    });

  const setupRevokeBoostMocks = (
    boost: SelectBoostBonus,
    changes: Array<{
      id: string;
      balanceId: string;
      competitionId: string;
    }> = [],
  ) => {
    setupMockTransaction();
    mockBoostRepo.findBoostBonusById.mockResolvedValue(boost);
    mockUserRepo.findById.mockResolvedValue(
      createMockUser({ id: testUserId, walletAddress: testWallet }),
    );
    mockBoostRepo.findBoostChangesByBoostBonusId.mockResolvedValue(changes);
  };

  beforeEach(() => {
    mockDb = mock<Database>();
    mockBoostRepo = mock<BoostRepository>();
    mockUserRepo = mock<UserRepository>();
    mockCompetitionRepo = mock<CompetitionRepository>();
    mockLogger = mock<Logger>();

    service = new BoostBonusService(
      mockDb,
      mockBoostRepo,
      mockCompetitionRepo,
      mockUserRepo,
      mockLogger,
    );
  });

  afterEach(() => {
    mockReset(mockDb);
    mockReset(mockBoostRepo);
    mockReset(mockUserRepo);
    mockReset(mockCompetitionRepo);
    vi.clearAllMocks();
  });

  describe("addBoostBonus", () => {
    it("creates boost and applies to eligible competitions", async () => {
      const now = new Date();
      const amount = 1000n;
      const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      mockCompetitionRepo.findByStatus
        .mockResolvedValueOnce({
          competitions: [
            setupCompetition(
              "comp-1",
              "active",
              new Date(now.getTime() - 1000),
              new Date(now.getTime() + ONE_DAY_MS * 2),
            ),
          ],
          total: 1,
        })
        .mockResolvedValueOnce({
          competitions: [
            setupCompetition(
              "comp-2",
              "pending",
              new Date(now.getTime() + 1000),
              new Date(now.getTime() + ONE_DAY_MS * 2),
            ),
          ],
          total: 1,
        });
      mockBoostRepo.increase.mockResolvedValue({
        type: "applied",
        changeId: "change-123",
        balanceAfter: amount,
        idemKey: new Uint8Array(32),
      });

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.boostBonusId).toBe(testBoostBonusId);
      expect(result.userId).toBe(testUserId);
      expect(result.amount).toBe(amount);
      expect(mockBoostRepo.createBoostBonus).toHaveBeenCalled();
      expect(mockBoostRepo.increase).toHaveBeenCalled();
    });

    it("validates amount is greater than 0", async () => {
      setupMockTransaction();
      await expect(
        service.addBoostBonus(
          testWallet,
          0n,
          new Date(Date.now() + ONE_DAY_MS),
        ),
      ).rejects.toThrow("Boost amount must be greater than 0");
    });

    it("validates amount is not negative", async () => {
      setupMockTransaction();
      await expect(
        service.addBoostBonus(
          testWallet,
          -1000n,
          new Date(Date.now() + ONE_DAY_MS),
        ),
      ).rejects.toThrow("Boost amount must be greater than 0");
    });

    it("validates amount does not exceed maximum (10^24)", async () => {
      setupMockTransaction();
      await expect(
        service.addBoostBonus(
          testWallet,
          10n ** 24n + 1n,
          new Date(Date.now() + ONE_DAY_MS),
        ),
      ).rejects.toThrow("Boost amount exceeds maximum allowed value");
    });

    it("validates expiration date is in the future", async () => {
      setupMockTransaction();
      await expect(
        service.addBoostBonus(testWallet, 1000n, new Date(Date.now() - 1000)),
      ).rejects.toThrow("at least 1 minute in the future");
    });

    it("validates expiration is not less than 60 seconds in future", async () => {
      setupMockTransaction();
      await expect(
        service.addBoostBonus(testWallet, 1000n, new Date(Date.now() + 59000)),
      ).rejects.toThrow("at least 1 minute in the future");
    });

    it("allows expiration exactly 60 seconds in future", async () => {
      const amount = 1000n;
      const expiresAt = new Date(Date.now() + ONE_MINUTE_MS + 100);

      setupBasicBoostMocks(amount, expiresAt);
      setupEmptyCompetitions();

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.boostBonusId).toBe(testBoostBonusId);
      expect(mockBoostRepo.createBoostBonus).toHaveBeenCalled();
    });

    it("validates meta field does not exceed max length", async () => {
      setupMockTransaction();
      const meta = { description: "x".repeat(MAX_META_LENGTH + 1) };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field exceeds maximum length");
    });

    it("validates meta field does not contain nested objects", async () => {
      setupMockTransaction();
      const meta = { campaign: { id: "123", name: "test" } };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field must only contain primitives");
    });

    it("validates meta field does not contain arrays", async () => {
      setupMockTransaction();
      const meta = { tags: ["promo", "campaign"] };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field must only contain primitives");
    });

    it("validates meta field does not contain BigInt", async () => {
      setupMockTransaction();
      const meta = { boostId: 123n };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field must only contain primitives");
    });

    it("validates meta field does not contain Symbol", async () => {
      setupMockTransaction();
      const meta = { source: Symbol("internal") };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field must only contain primitives");
    });

    it("validates meta field does not contain undefined", async () => {
      setupMockTransaction();
      const meta = { metadata: undefined };

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
          undefined,
          meta,
        ),
      ).rejects.toThrow("Meta field must only contain primitives");
    });

    it("runs within a database transaction", async () => {
      const amount = 1000n;
      const expiresAt = new Date(Date.now() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      setupEmptyCompetitions();

      await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("returns empty arrays when no competitions are eligible", async () => {
      const amount = 1000n;
      const expiresAt = new Date(Date.now() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      setupEmptyCompetitions();

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.appliedToCompetitions).toHaveLength(0);
      expect(mockBoostRepo.increase).not.toHaveBeenCalled();
    });

    it("skips competition when boostStartDate equals expiresAt (boundary)", async () => {
      const now = new Date();
      const amount = 1000n;
      const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [
          setupCompetition(
            "comp-1",
            "active",
            expiresAt,
            new Date(now.getTime() + TWO_DAYS_MS),
          ),
        ],
        total: 1,
      });

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.appliedToCompetitions).toHaveLength(0);
      expect(mockBoostRepo.increase).not.toHaveBeenCalled();
    });

    it("skips competition when boostEndDate equals now (boundary)", async () => {
      const now = new Date();
      const amount = 1000n;
      const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [
          setupCompetition(
            "comp-1",
            "active",
            new Date(now.getTime() - ONE_DAY_MS),
            now,
          ),
        ],
        total: 1,
      });

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.appliedToCompetitions).toHaveLength(0);
      expect(mockBoostRepo.increase).not.toHaveBeenCalled();
    });

    it("handles noop result from boost increase", async () => {
      const now = new Date();
      const amount = 1000n;
      const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

      setupBasicBoostMocks(amount, expiresAt);
      mockCompetitionRepo.findByStatus.mockResolvedValue({
        competitions: [
          setupCompetition(
            "comp-1",
            "active",
            new Date(now.getTime() - 1000),
            new Date(now.getTime() + ONE_DAY_MS * 2),
          ),
        ],
        total: 1,
      });
      mockBoostRepo.increase.mockResolvedValue({
        type: "noop",
        balance: amount,
        idemKey: new Uint8Array(32),
      });

      const result = await service.addBoostBonus(testWallet, amount, expiresAt);

      expect(result.appliedToCompetitions).toHaveLength(0);
      expect(mockBoostRepo.increase).toHaveBeenCalled();
    });

    it("propagates database transaction errors", async () => {
      mockDb.transaction.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
        ),
      ).rejects.toThrow("Database connection failed");
    });

    it("propagates repository errors within transaction", async () => {
      setupMockTransaction();
      mockUserRepo.findByWalletAddress.mockRejectedValue(
        new Error("Repository error"),
      );

      await expect(
        service.addBoostBonus(
          testWallet,
          1000n,
          new Date(Date.now() + ONE_DAY_MS),
        ),
      ).rejects.toThrow("Repository error");
    });
  });

  describe("revokeBoostBonus", () => {
    const createBoost = (amount = 1000n): SelectBoostBonus =>
      createMockBoostBonus({
        id: testBoostBonusId,
        userId: testUserId,
        amount,
        isActive: true,
        revokedAt: null,
      });

    it("marks boost as inactive and removes from competitions where window hasn't opened", async () => {
      const boost = createBoost();
      setupRevokeBoostMocks(boost, [
        { id: "change-1", balanceId: "bal-1", competitionId: "comp-1" },
      ]);
      mockBoostRepo.updateBoostBonus.mockResolvedValue(
        createMockBoostBonus({
          ...boost,
          isActive: false,
          revokedAt: new Date(),
        }),
      );
      mockCompetitionRepo.findById.mockResolvedValue(
        mock<EnrichedCompetition>({
          id: "comp-1",
          boostStartDate: new Date(Date.now() + ONE_DAY_MS),
          boostEndDate: new Date(Date.now() + TWO_DAYS_MS),
        }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "applied",
        changeId: "change-rev",
        balanceAfter: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.revokeBoostBonus(testBoostBonusId);

      expect(result.revoked).toBe(true);
      expect(result.boostBonusId).toBe(testBoostBonusId);
      expect(mockBoostRepo.updateBoostBonus).toHaveBeenCalledWith(
        testBoostBonusId,
        expect.objectContaining({ isActive: false }),
        expect.anything(),
      );
    });

    it("throws error if boost not found", async () => {
      setupMockTransaction();
      mockBoostRepo.findBoostBonusById.mockResolvedValue(undefined);

      await expect(service.revokeBoostBonus(testBoostBonusId)).rejects.toThrow(
        "not found",
      );
    });

    it("throws error if boost already revoked", async () => {
      setupMockTransaction();
      mockBoostRepo.findBoostBonusById.mockResolvedValue(
        createMockBoostBonus({ id: testBoostBonusId, isActive: false }),
      );

      await expect(service.revokeBoostBonus(testBoostBonusId)).rejects.toThrow(
        "already revoked",
      );
    });

    it("keeps boost if boosting window is open", async () => {
      const now = new Date();
      const boost = createBoost();
      setupRevokeBoostMocks(boost, [
        { id: "change-1", balanceId: "bal-1", competitionId: "comp-1" },
      ]);
      mockBoostRepo.updateBoostBonus.mockResolvedValue(
        createMockBoostBonus({ ...boost, isActive: false, revokedAt: now }),
      );
      mockCompetitionRepo.findById.mockResolvedValue(
        mock<EnrichedCompetition>({
          id: "comp-1",
          boostStartDate: new Date(now.getTime() - 1000),
          boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
        }),
      );

      const result = await service.revokeBoostBonus(testBoostBonusId);

      expect(result.keptInCompetitions).toContain("comp-1");
      expect(result.removedFromCompetitions).toHaveLength(0);
      expect(mockBoostRepo.decrease).not.toHaveBeenCalled();
    });

    it("runs within a database transaction", async () => {
      const boost = createBoost();
      setupRevokeBoostMocks(boost);
      mockBoostRepo.updateBoostBonus.mockResolvedValue(
        createMockBoostBonus({ ...boost, isActive: false }),
      );

      await service.revokeBoostBonus(testBoostBonusId);

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("handles noop result from boost decrease", async () => {
      const now = new Date();
      const boost = createBoost();

      setupRevokeBoostMocks(boost, [
        { id: "change-1", balanceId: "bal-1", competitionId: "comp-1" },
      ]);
      mockBoostRepo.updateBoostBonus.mockResolvedValue(
        createMockBoostBonus({ ...boost, isActive: false, revokedAt: now }),
      );
      mockCompetitionRepo.findById.mockResolvedValue(
        mock<EnrichedCompetition>({
          id: "comp-1",
          boostStartDate: new Date(now.getTime() + 1000),
          boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
        }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "noop",
        balance: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.revokeBoostBonus(testBoostBonusId);

      expect(result.revoked).toBe(true);
      expect(mockBoostRepo.decrease).toHaveBeenCalled();
    });

    it("propagates database transaction errors", async () => {
      mockDb.transaction.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(service.revokeBoostBonus(testBoostBonusId)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("propagates repository errors within transaction", async () => {
      setupMockTransaction();
      mockBoostRepo.findBoostBonusById.mockRejectedValue(
        new Error("Repository error"),
      );

      await expect(service.revokeBoostBonus(testBoostBonusId)).rejects.toThrow(
        "Repository error",
      );
    });
  });

  describe("Error Handling", () => {
    describe("checkForeignKeyViolation helper", () => {
      it("detects PostgreSQL foreign key violations (23503)", () => {
        const fkError = {
          code: "23503",
          constraint: "boost_balances_competition_id_competitions_id_fk",
        };

        const constraint = checkForeignKeyViolation(fkError);
        expect(constraint).toBe(
          "boost_balances_competition_id_competitions_id_fk",
        );
      });

      it("returns undefined for non-FK errors", () => {
        const uniqueError = {
          code: "23505",
          constraint: "some_unique_constraint",
        };

        const constraint = checkForeignKeyViolation(uniqueError);
        expect(constraint).toBeUndefined();
      });

      it("returns undefined for errors without code", () => {
        const genericError = new Error("Some other error");

        const constraint = checkForeignKeyViolation(genericError);
        expect(constraint).toBeUndefined();
      });

      it("identifies competition_id FK violations", () => {
        const competitionFkError = {
          code: "23503",
          constraint: "boost_balances_competition_id_competitions_id_fk",
        };

        const constraint = checkForeignKeyViolation(competitionFkError);
        expect(constraint?.includes("competition_id")).toBe(true);
      });

      it("identifies user_id FK violations", () => {
        const userFkError = {
          code: "23503",
          constraint: "boost_balances_user_id_users_id_fk",
        };

        const constraint = checkForeignKeyViolation(userFkError);
        expect(constraint?.includes("user_id")).toBe(true);
      });

      it("does not confuse user_id and competition_id FK violations", () => {
        const userFkError = {
          code: "23503",
          constraint: "boost_balances_user_id_users_id_fk",
        };

        const competitionFkError = {
          code: "23503",
          constraint: "boost_balances_competition_id_competitions_id_fk",
        };

        const userConstraint = checkForeignKeyViolation(userFkError);
        const competitionConstraint =
          checkForeignKeyViolation(competitionFkError);

        expect(userConstraint?.includes("competition_id")).toBe(false);
        expect(userConstraint?.includes("user_id")).toBe(true);

        expect(competitionConstraint?.includes("user_id")).toBe(false);
        expect(competitionConstraint?.includes("competition_id")).toBe(true);
      });
    });

    describe("FK violation service behavior", () => {
      const competitionFkError = {
        code: "23503",
        constraint: "boost_balances_competition_id_competitions_id_fk",
      };

      it("addBoostBonus skips competition when FK violation occurs", async () => {
        const now = new Date();
        const amount = 1000n;
        const expiresAt = new Date(now.getTime() + ONE_DAY_MS);

        setupBasicBoostMocks(amount, expiresAt);
        mockCompetitionRepo.findByStatus
          .mockResolvedValueOnce({
            competitions: [
              setupCompetition(
                "comp-1",
                "active",
                new Date(now.getTime() - 1000),
                new Date(now.getTime() + ONE_DAY_MS * 2),
              ),
              setupCompetition(
                "comp-2",
                "active",
                new Date(now.getTime() - 1000),
                new Date(now.getTime() + ONE_DAY_MS * 2),
              ),
            ],
            total: 2,
          })
          .mockResolvedValueOnce({
            competitions: [],
            total: 0,
          });

        mockBoostRepo.increase
          .mockRejectedValueOnce(competitionFkError)
          .mockResolvedValueOnce({
            type: "applied",
            changeId: "change-2",
            balanceAfter: amount,
            idemKey: new Uint8Array(32),
          });

        const result = await service.addBoostBonus(
          testWallet,
          amount,
          expiresAt,
        );

        expect(result.boostBonusId).toBe(testBoostBonusId);
        expect(result.appliedToCompetitions).toEqual(["comp-2"]);
        expect(mockBoostRepo.increase).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { boostBonusId: testBoostBonusId, competitionId: "comp-1" },
          "Competition was deleted during boost application - skipping",
        );
      });

      it("revokeBoostBonus skips competition when FK violation occurs", async () => {
        const now = new Date();
        const boost = createMockBoostBonus({
          id: testBoostBonusId,
          userId: testUserId,
          amount: 1000n,
          isActive: true,
        });

        setupRevokeBoostMocks(boost, [
          { id: "change-1", balanceId: "bal-1", competitionId: "comp-1" },
          { id: "change-2", balanceId: "bal-2", competitionId: "comp-2" },
        ]);
        mockBoostRepo.updateBoostBonus.mockResolvedValue(
          createMockBoostBonus({ ...boost, isActive: false, revokedAt: now }),
        );
        mockCompetitionRepo.findById
          .mockResolvedValueOnce(
            mock<EnrichedCompetition>({
              id: "comp-1",
              boostStartDate: new Date(now.getTime() + 1000),
              boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
            }),
          )
          .mockResolvedValueOnce(
            mock<EnrichedCompetition>({
              id: "comp-2",
              boostStartDate: new Date(now.getTime() + 1000),
              boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
            }),
          );

        mockBoostRepo.decrease
          .mockRejectedValueOnce(competitionFkError)
          .mockResolvedValueOnce({
            type: "applied",
            changeId: "change-rev",
            balanceAfter: 0n,
            idemKey: new Uint8Array(32),
          });

        const result = await service.revokeBoostBonus(testBoostBonusId);

        expect(result.revoked).toBe(true);
        expect(result.removedFromCompetitions).toEqual(["comp-2"]);
        expect(mockBoostRepo.decrease).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { boostBonusId: testBoostBonusId, competitionId: "comp-1" },
          "Competition was deleted during boost revocation - skipping",
        );
      });

      it("addBoostBonus skips competition when balance_id FK violation occurs (cascade delete)", async () => {
        const now = new Date();
        const amount = 1000n;
        const expiresAt = new Date(now.getTime() + ONE_DAY_MS);
        const balanceFkError = {
          code: "23503",
          constraint: "boost_changes_balance_id_boost_balances_id_fk",
        };

        setupBasicBoostMocks(amount, expiresAt);
        mockCompetitionRepo.findByStatus
          .mockResolvedValueOnce({
            competitions: [
              setupCompetition(
                "comp-1",
                "active",
                new Date(now.getTime() - 1000),
                new Date(now.getTime() + ONE_DAY_MS * 2),
              ),
              setupCompetition(
                "comp-2",
                "active",
                new Date(now.getTime() - 1000),
                new Date(now.getTime() + ONE_DAY_MS * 2),
              ),
            ],
            total: 2,
          })
          .mockResolvedValueOnce({
            competitions: [],
            total: 0,
          });

        mockBoostRepo.increase
          .mockRejectedValueOnce(balanceFkError)
          .mockResolvedValueOnce({
            type: "applied",
            changeId: "change-2",
            balanceAfter: amount,
            idemKey: new Uint8Array(32),
          });

        const result = await service.addBoostBonus(
          testWallet,
          amount,
          expiresAt,
        );

        expect(result.boostBonusId).toBe(testBoostBonusId);
        expect(result.appliedToCompetitions).toEqual(["comp-2"]);
        expect(mockBoostRepo.increase).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { boostBonusId: testBoostBonusId, competitionId: "comp-1" },
          "Competition was deleted during boost application - skipping",
        );
      });

      it("revokeBoostBonus skips competition when balance_id FK violation occurs (cascade delete)", async () => {
        const now = new Date();
        const boost = createMockBoostBonus({
          id: testBoostBonusId,
          userId: testUserId,
          amount: 1000n,
          isActive: true,
        });
        const balanceFkError = {
          code: "23503",
          constraint: "boost_changes_balance_id_boost_balances_id_fk",
        };

        setupRevokeBoostMocks(boost, [
          { id: "change-1", balanceId: "bal-1", competitionId: "comp-1" },
          { id: "change-2", balanceId: "bal-2", competitionId: "comp-2" },
        ]);
        mockBoostRepo.updateBoostBonus.mockResolvedValue(
          createMockBoostBonus({ ...boost, isActive: false, revokedAt: now }),
        );
        mockCompetitionRepo.findById
          .mockResolvedValueOnce(
            mock<EnrichedCompetition>({
              id: "comp-1",
              boostStartDate: new Date(now.getTime() + 1000),
              boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
            }),
          )
          .mockResolvedValueOnce(
            mock<EnrichedCompetition>({
              id: "comp-2",
              boostStartDate: new Date(now.getTime() + 1000),
              boostEndDate: new Date(now.getTime() + ONE_DAY_MS),
            }),
          );

        mockBoostRepo.decrease
          .mockRejectedValueOnce(balanceFkError)
          .mockResolvedValueOnce({
            type: "applied",
            changeId: "change-rev",
            balanceAfter: 0n,
            idemKey: new Uint8Array(32),
          });

        const result = await service.revokeBoostBonus(testBoostBonusId);

        expect(result.revoked).toBe(true);
        expect(result.removedFromCompetitions).toEqual(["comp-2"]);
        expect(mockBoostRepo.decrease).toHaveBeenCalledTimes(2);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          { boostBonusId: testBoostBonusId, competitionId: "comp-1" },
          "Competition was deleted during boost revocation - skipping",
        );
      });

      it("addBoostBonus propagates user_id FK violations", async () => {
        const now = new Date();
        const amount = 1000n;
        const expiresAt = new Date(now.getTime() + ONE_DAY_MS);
        const userFkError = {
          code: "23503",
          constraint: "boost_balances_user_id_users_id_fk",
        };

        setupBasicBoostMocks(amount, expiresAt);
        mockCompetitionRepo.findByStatus.mockResolvedValue({
          competitions: [
            setupCompetition(
              "comp-1",
              "active",
              new Date(now.getTime() - 1000),
              new Date(now.getTime() + ONE_DAY_MS * 2),
            ),
          ],
          total: 1,
        });
        mockBoostRepo.increase.mockRejectedValue(userFkError);

        await expect(
          service.addBoostBonus(testWallet, amount, expiresAt),
        ).rejects.toMatchObject({
          code: "23503",
          constraint: "boost_balances_user_id_users_id_fk",
        });
      });
    });
  });

  describe("cleanupInvalidBoostBonusesForCompetition", () => {
    const competitionId = "comp-123";

    const setupCleanupMocks = (
      boostChanges: Array<{
        id: string;
        balanceId: string;
        meta: Record<string, unknown>;
      }>,
      boosts: SelectBoostBonus[],
    ) => {
      setupMockTransaction();
      mockBoostRepo.findBoostChangesByCompetitionId.mockResolvedValue(
        boostChanges,
      );
      mockBoostRepo.findBoostBonusesByIds.mockResolvedValue(boosts);
      const userIds = [...new Set(boosts.map((b) => b.userId))];
      const users = userIds.map((id) =>
        createMockUser({ id, walletAddress: testWallet }),
      );
      mockUserRepo.findByIds.mockResolvedValue(users);
    };

    it("removes invalid boosts when boostStartDate moves after boost expiration", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(
        now.getTime() + TWO_DAYS_MS + ONE_DAY_MS,
      );
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "applied",
        changeId: "cleanup-change",
        balanceAfter: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toEqual(["boost-123"]);
      expect(result.keptBoostIds).toHaveLength(0);
      expect(mockBoostRepo.decrease).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: testUserId,
          competitionId,
          amount: 1000n,
          meta: expect.objectContaining({
            description: expect.stringContaining("Cleanup invalid bonus boost"),
            boostBonusId: "boost-123",
          }),
        }),
        expect.anything(),
      );
    });

    it("keeps boosts when boostStartDate still before expiration", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + ONE_DAY_MS + 1000);
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(result.keptBoostIds).toEqual(["boost-123"]);
      expect(mockBoostRepo.decrease).not.toHaveBeenCalled();
    });

    it("keeps all boosts when previous window already opened", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() - 1000);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);

      setupMockTransaction();
      mockBoostRepo.findBoostChangesByCompetitionId.mockResolvedValue([
        {
          id: "change-1",
          balanceId: "bal-1",
          meta: { boostBonusId: "boost-123" },
        },
        {
          id: "change-2",
          balanceId: "bal-2",
          meta: { boostBonusId: "boost-456" },
        },
      ]);

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(result.keptBoostIds).toEqual(["boost-123", "boost-456"]);
      expect(mockBoostRepo.findBoostChangesByCompetitionId).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          oldBoostStartDate,
          newBoostStartDate,
        }),
        expect.stringContaining("window already opened"),
      );
    });

    it("handles null oldBoostStartDate by proceeding with cleanup", async () => {
      const now = new Date();
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);
      const boostExpiresAt = new Date(now.getTime() + ONE_DAY_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "applied",
        changeId: "cleanup-change",
        balanceAfter: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        null,
      );

      expect(result.removedBoostIds).toEqual(["boost-123"]);
      expect(mockBoostRepo.findBoostChangesByCompetitionId).toHaveBeenCalled();
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("Previous boosting window already opened"),
      );
    });

    it("keeps all boosts when newBoostStartDate is in the past", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() - ONE_DAY_MS);

      setupMockTransaction();
      mockBoostRepo.findBoostChangesByCompetitionId.mockResolvedValue([
        {
          id: "change-1",
          balanceId: "bal-1",
          meta: { boostBonusId: "boost-789" },
        },
      ]);

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(result.keptBoostIds).toEqual(["boost-789"]);
      expect(mockBoostRepo.findBoostChangesByCompetitionId).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          competitionId,
          oldBoostStartDate,
          newBoostStartDate,
        }),
        expect.stringContaining("window already opened"),
      );
    });

    it("treats boostStartDate exactly equal to expiresAt as invalid (boundary)", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);
      const newBoostStartDate = boostExpiresAt;

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "applied",
        changeId: "cleanup-change",
        balanceAfter: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toEqual(["boost-123"]);
      expect(mockBoostRepo.decrease).toHaveBeenCalled();
    });

    it("returns empty arrays when no boost changes found", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);

      setupCleanupMocks([], []);

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(result.keptBoostIds).toHaveLength(0);
      expect(mockBoostRepo.findBoostBonusesByIds).not.toHaveBeenCalled();
    });

    it("returns empty arrays when boost changes have no boostBonusId in meta", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: {},
          },
        ],
        [],
      );

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(result.keptBoostIds).toHaveLength(0);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ competitionId }),
        expect.stringContaining(
          "No boost_changes entries have boostBonusId in meta",
        ),
      );
    });

    it("handles multiple boosts with mixed validity", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);
      const validExpiresAt = new Date(now.getTime() + TWO_DAYS_MS + 1000);
      const invalidExpiresAt = new Date(now.getTime() + ONE_DAY_MS + 1000);

      const validBoost = createMockBoostBonus({
        id: "boost-valid",
        userId: testUserId,
        amount: 1000n,
        expiresAt: validExpiresAt,
      });

      const invalidBoost = createMockBoostBonus({
        id: "boost-invalid",
        userId: testUserId,
        amount: 500n,
        expiresAt: invalidExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-valid" },
          },
          {
            id: "change-2",
            balanceId: "bal-2",
            meta: { boostBonusId: "boost-invalid" },
          },
        ],
        [validBoost, invalidBoost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "applied",
        changeId: "cleanup-change",
        balanceAfter: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toEqual(["boost-invalid"]);
      expect(result.keptBoostIds).toEqual(["boost-valid"]);
      expect(mockBoostRepo.decrease).toHaveBeenCalledTimes(1);
    });

    it("handles noop result from boost decrease", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(
        now.getTime() + TWO_DAYS_MS + ONE_DAY_MS,
      );
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockResolvedValue({
        type: "noop",
        balance: 0n,
        idemKey: new Uint8Array(32),
      });

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(mockBoostRepo.decrease).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ boostBonusId: "boost-123", competitionId }),
        expect.stringContaining("Idempotency prevented cleanup"),
      );
    });

    it("skips boost when user not found", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(
        now.getTime() + TWO_DAYS_MS + ONE_DAY_MS,
      );
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findByIds.mockResolvedValue([]);

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(mockBoostRepo.decrease).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          boostBonusId: "boost-123",
          userId: testUserId,
        }),
        expect.stringContaining("User not found during boost cleanup"),
      );
    });

    it("skips competition when FK violation occurs", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(
        now.getTime() + TWO_DAYS_MS + ONE_DAY_MS,
      );
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);
      const competitionFkError = {
        code: "23503",
        constraint: "boost_balances_competition_id_competitions_id_fk",
      };

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockRejectedValue(competitionFkError);

      const result = await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(result.removedBoostIds).toHaveLength(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ boostBonusId: "boost-123", competitionId }),
        expect.stringContaining("Competition was deleted during boost cleanup"),
      );
    });

    it("propagates non-FK errors", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(
        now.getTime() + TWO_DAYS_MS + ONE_DAY_MS,
      );
      const boostExpiresAt = new Date(now.getTime() + TWO_DAYS_MS);

      const boost = createMockBoostBonus({
        id: "boost-123",
        userId: testUserId,
        amount: 1000n,
        expiresAt: boostExpiresAt,
      });

      setupCleanupMocks(
        [
          {
            id: "change-1",
            balanceId: "bal-1",
            meta: { boostBonusId: "boost-123" },
          },
        ],
        [boost],
      );
      mockUserRepo.findById.mockResolvedValue(
        createMockUser({ id: testUserId, walletAddress: testWallet }),
      );
      mockBoostRepo.decrease.mockRejectedValue(
        new Error("Unexpected database error"),
      );

      await expect(
        service.cleanupInvalidBoostBonusesForCompetition(
          competitionId,
          newBoostStartDate,
          oldBoostStartDate,
        ),
      ).rejects.toThrow("Unexpected database error");
    });

    it("runs within a database transaction", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);

      setupCleanupMocks([], []);

      await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it("works with external transaction parameter", async () => {
      const now = new Date();
      const oldBoostStartDate = new Date(now.getTime() + ONE_DAY_MS);
      const newBoostStartDate = new Date(now.getTime() + TWO_DAYS_MS);
      const externalTx = "external-tx" as unknown as Transaction;

      mockBoostRepo.findBoostChangesByCompetitionId.mockResolvedValue([]);

      await service.cleanupInvalidBoostBonusesForCompetition(
        competitionId,
        newBoostStartDate,
        oldBoostStartDate,
        externalTx,
      );

      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(
        mockBoostRepo.findBoostChangesByCompetitionId,
      ).toHaveBeenCalledWith(competitionId, externalTx);
    });
  });
});
