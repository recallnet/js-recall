import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";

import { AirdropService, ClaimData } from "../airdrop.service.js";

describe("AirdropService", () => {
  let service: AirdropService;
  let mockAirdropRepository: DeepMockProxy<AirdropRepository>;
  let mockConvictionClaimsRepository: DeepMockProxy<ConvictionClaimsRepository>;
  let mockBoostRepository: DeepMockProxy<BoostRepository>;
  let mockCompetitionRepository: DeepMockProxy<CompetitionRepository>;
  let mockLogger: DeepMockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mockDeep<Logger>();
    mockAirdropRepository = mockDeep<AirdropRepository>();
    mockConvictionClaimsRepository = mockDeep<ConvictionClaimsRepository>();
    mockBoostRepository = mockDeep<BoostRepository>();
    mockCompetitionRepository = mockDeep<CompetitionRepository>();

    service = new AirdropService(
      mockAirdropRepository,
      mockLogger,
      mockConvictionClaimsRepository,
      mockBoostRepository,
      mockCompetitionRepository,
    );
  });

  describe("getAccountClaimsData", () => {
    it("should return claims data for an address with allocations and no claims", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const now = new Date();
      const season0Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const season1Start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: season0Start,
          endDate: new Date(season0Start.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          startsWithAirdrop: 1,
          number: 2,
          name: "Season 1",
          startDate: season1Start,
          endDate: new Date(season1Start.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: ["0xproof1", "0xproof2"],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: true,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("2000000000000000000"),
          airdrop: 1,
          proof: ["0xproof3", "0xproof4"],
          category: "regular",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: true,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(2);

      const firstClaim = result[0]!;
      expect(firstClaim.type).toBe("available");
      expect(firstClaim.airdrop).toBe(1);
      expect(firstClaim.airdropName).toBe("Airdrop 1");
      if (firstClaim.type === "available") {
        expect(firstClaim.eligibleAmount).toBe(BigInt("2000000000000000000"));
        expect(firstClaim.proof).toEqual(["0xproof3", "0xproof4"]);
        expect(firstClaim.expiresAt).toBeDefined();
      }

      // Season 0 is now available during Season 1 (following season has not ended)
      const secondClaim = result[1]!;
      expect(secondClaim.type).toBe("available");
      expect(secondClaim.airdrop).toBe(0);
      expect(secondClaim.airdropName).toBe("Genesis");
      if (secondClaim.type === "available") {
        expect(secondClaim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(secondClaim.proof).toEqual([]); // Season 0 has empty proof array
        expect(secondClaim.expiresAt).toBeDefined();
      }
    });

    it("should mark sybil accounts as ineligible", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: ["0xproof1", "0xproof2"],
          category: "early",
          sybilClassification: "sybil",
          flaggedAt: new Date("2024-01-01"),
          flaggingReason: "Suspicious activity detected",
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("ineligible");
      if (claim.type === "ineligible") {
        expect(claim.ineligibleReason).toBe("Suspicious activity detected");
      }
    });

    it("should mark maybe-sybil accounts with review message", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: ["0xproof1", "0xproof2"],
          category: "early",
          sybilClassification: "maybe-sybil",
          flaggedAt: null,
          flaggingReason: "Account under review for potential sybil activity",
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("ineligible");
      if (claim.type === "ineligible") {
        expect(claim.ineligibleReason).toBe(
          "Account under review for potential sybil activity",
        );
      }
    });

    it("should handle multiple seasons with different claim statuses", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const now = new Date();
      const claimTimestamp = new Date(now.getTime() - 50 * 24 * 60 * 60 * 1000); // 50 days ago
      const season0Start = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
      const season1Start = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const season2Start = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: season0Start,
          endDate: new Date(season0Start.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          startsWithAirdrop: 1,
          number: 2,
          name: "Season 1",
          startDate: season1Start,
          endDate: new Date(season1Start.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
        {
          startsWithAirdrop: 2,
          number: 3,
          name: "Season 2",
          startDate: season2Start,
          endDate: new Date(season2Start.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: ["0xproof1"],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: true,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("2000000000000000000"),
          airdrop: 1,
          proof: ["0xproof2"],
          category: "regular",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: true,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("3000000000000000000"),
          airdrop: 2,
          proof: ["0xproof3"],
          category: "bonus",
          sybilClassification: "sybil",
          flaggedAt: new Date(),
          flaggingReason: "Account flagged as sybil",
          powerUser: false,
          recallSnapper: false,
          aiBuilder: true,
          aiExplorer: true,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([
        {
          id: "claim-1",
          account: mockAddress.toLowerCase(),
          walletAddress: mockAddress.toLowerCase(),
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: 0n, // No staking
          blockNumber: BigInt(1000000),
          blockTimestamp: claimTimestamp,
          transactionHash: Buffer.from("txhash"),
          createdAt: claimTimestamp,
          updatedAt: claimTimestamp,
        },
      ]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(3);

      // Check sorting (most recent season first)
      expect(result[0]!.airdrop).toBe(2);
      expect(result[1]!.airdrop).toBe(1);
      expect(result[2]!.airdrop).toBe(0);

      // Season 2 - Sybil flagged
      const season2Claim = result[0]!;
      expect(season2Claim.type).toBe("ineligible");
      if (season2Claim.type === "ineligible") {
        expect(season2Claim.ineligibleReason).toBe("Account flagged as sybil");
      }

      // Season 1 - Available (following season 2 has not ended yet)
      const season1Claim = result[1]!;
      expect(season1Claim.type).toBe("available");
      if (season1Claim.type === "available") {
        expect(season1Claim.eligibleAmount).toBe(BigInt("2000000000000000000"));
        expect(season1Claim.expiresAt).toBeDefined();
      }

      // Season 0 - Claimed without staking
      const season0Claim = result[2]!;
      expect(season0Claim.type).toBe("claimed-and-not-staked");
      if (season0Claim.type === "claimed-and-not-staked") {
        expect(season0Claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(season0Claim.claimedAmount).toBe(BigInt("1000000000000000000"));
        expect(season0Claim.claimedAt).toEqual(claimTimestamp);
      }
    });

    it("should handle claimed allocation with staking", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const claimTimestamp = new Date("2024-01-01T00:00:00Z");
      const stakeDurationSeconds = 86400; // 1 day

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-12-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: ["0xproof1"],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: true,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([
        {
          id: "claim-1",
          account: mockAddress.toLowerCase(),
          walletAddress: mockAddress.toLowerCase(),
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(stakeDurationSeconds),
          blockNumber: BigInt(1000000),
          blockTimestamp: claimTimestamp,
          transactionHash: Buffer.from("txhash"),
          createdAt: claimTimestamp,
          updatedAt: claimTimestamp,
        },
      ]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("claimed-and-staked");
      expect(claim.airdrop).toBe(0);
      expect(claim.airdropName).toBe("Genesis");
      if (claim.type === "claimed-and-staked") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.claimedAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.stakeDuration).toBe(stakeDurationSeconds);
        expect(claim.claimedAt).toEqual(claimTimestamp);
        expect(claim.unlocksAt).toEqual(
          new Date(
            claimTimestamp.getTime() + Number(stakeDurationSeconds) * 1000,
          ),
        );
      }
    });

    it("should handle empty allocations", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getSeasons.mockResolvedValue([]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(0);
    });

    it("should handle errors gracefully", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const error = new Error("Database connection failed");

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2024-01-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockRejectedValue(
        error,
      );

      await expect(service.getAccountClaimsData(mockAddress)).rejects.toThrow(
        "Database connection failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        `Error fetching claims data for address ${mockAddress}`,
      );
    });

    it("should assign correct season names", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-01-01"),
        },
        {
          startsWithAirdrop: 1,
          number: 2,
          name: "Season 1",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2026-01-01"),
        },
        {
          startsWithAirdrop: 2,
          number: 3,
          name: "Season 2",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-01-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000"),
          airdrop: 0,
          proof: [],
          category: "",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000"),
          airdrop: 1,
          proof: [],
          category: "",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000"),
          airdrop: 2,
          proof: [],
          category: "",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result.find((c: ClaimData) => c.airdrop === 0)?.airdropName).toBe(
        "Genesis",
      );
      expect(result.find((c: ClaimData) => c.airdrop === 1)?.airdropName).toBe(
        "Airdrop 1",
      );
      expect(result.find((c: ClaimData) => c.airdrop === 2)?.airdropName).toBe(
        "Airdrop 2",
      );
    });

    it("should mark unclaimed allocation as expired when 90 days past season start for season 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const seasonStartDate = new Date("2023-01-01T00:00:00.000Z");
      const expectedExpiryDate = new Date("2023-04-01T00:00:00.000Z"); // 90 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: seasonStartDate,
          endDate: new Date(
            seasonStartDate.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: [],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("expired");
      expect(claim.airdrop).toBe(0);
      expect(claim.airdropName).toBe("Genesis");
      if (claim.type === "expired") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiredAt).toEqual(expectedExpiryDate);
      }
    });

    it("should mark allocation as expired when 30 days past season start for season > 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const seasonStartDate = new Date("2023-01-01T00:00:00.000Z");
      const expectedExpiryDate = new Date("2023-01-31T00:00:00.000Z"); // 30 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 1,
          number: 2,
          name: "Season 1",
          startDate: seasonStartDate,
          endDate: new Date(
            seasonStartDate.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 1,
          proof: ["0xproof1", "0xproof2"],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("expired");
      expect(claim.airdrop).toBe(1);
      expect(claim.airdropName).toBe("Airdrop 1");
      if (claim.type === "expired") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiredAt).toEqual(expectedExpiryDate);
      }
    });

    it("should mark allocation as available when within 90-day claim window for season 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const now = new Date();
      const seasonStartDate = new Date(
        now.getTime() - 45 * 24 * 60 * 60 * 1000,
      ); // 45 days ago
      const expectedExpiryDate = new Date(
        seasonStartDate.getTime() + 90 * 24 * 60 * 60 * 1000,
      ); // 90 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 0,
          number: 1,
          name: "Genesis",
          startDate: seasonStartDate,
          endDate: new Date(
            seasonStartDate.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 0,
          proof: [],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("available");
      expect(claim.airdrop).toBe(0);
      expect(claim.airdropName).toBe("Genesis");
      if (claim.type === "available") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiresAt).toEqual(expectedExpiryDate);
      }
    });

    it("should mark allocation as available when within 30-day claim window for season > 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const now = new Date();
      const seasonStartDate = new Date(
        now.getTime() - 15 * 24 * 60 * 60 * 1000,
      ); // 15 days ago
      const expectedExpiryDate = new Date(
        seasonStartDate.getTime() + 30 * 24 * 60 * 60 * 1000,
      ); // 30 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          startsWithAirdrop: 1,
          number: 2,
          name: "Season 1",
          startDate: seasonStartDate,
          endDate: new Date(
            seasonStartDate.getTime() + 30 * 24 * 60 * 60 * 1000,
          ),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          airdrop: 1,
          proof: ["0xproof1", "0xproof2"],
          category: "early",
          sybilClassification: "approved",
          flaggedAt: null,
          flaggingReason: null,
          powerUser: false,
          recallSnapper: false,
          aiBuilder: false,
          aiExplorer: false,
          ineligibleReason: null,
          ineligibleReward: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      const claim = result[0]!;
      expect(claim.type).toBe("available");
      expect(claim.airdrop).toBe(1);
      expect(claim.airdropName).toBe("Airdrop 1");
      if (claim.type === "available") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiresAt).toEqual(expectedExpiryDate);
      }
    });
  });

  describe("getNextAirdropEligibility", () => {
    const mockAddress = "0x1234567890123456789012345678901234567890";
    const mockSeason = {
      startsWithAirdrop: 1,
      number: 2,
      name: "Season 2",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-03-31T23:59:59Z"),
    };

    it("should return eligibility data when user has active stake and meets competition requirement", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      // Mock pool stats dependencies
      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );

      // User has active stake
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        1000n,
      );

      // User has participated in 3+ competitions
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-2", "comp-3"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.isEligible).toBe(true);
      expect(result.airdrop).toBe(2); // startsWithAirdrop + 1
      expect(result.activeStake).toBe(1000n);
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(3);
      expect(result.eligibilityReasons.hasBoostedAgents).toBe(true);
      expect(result.eligibilityReasons.hasCompetedInCompetitions).toBe(true);
      expect(result.poolStats.totalActiveStakes).toBe(10000n);
      expect(result.poolStats.availableRewardsPool).toBe(4000n); // 5000 - 1000
      expect(result.activitySeason.number).toBe(2);
    });

    it("should return ineligible when user has no active stake", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );

      // User has NO active stake
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );

      // User has participated in 3+ competitions
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.isEligible).toBe(false);
      expect(result.activeStake).toBe(0n);
      expect(result.potentialReward).toBe(0n);
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(3);
    });

    it("should return ineligible when user has insufficient competitions", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );

      // User has active stake
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        1000n,
      );

      // User has participated in only 2 competitions (below threshold of 3)
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-2"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.isEligible).toBe(false);
      expect(result.activeStake).toBe(1000n);
      expect(result.potentialReward).toBe(0n);
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(2);
    });

    it("should calculate potential reward correctly based on stake proportion", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      // Total pool: 10000, Available rewards: 4000 (5000 forfeited - 1000 claimed)
      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );

      // User has 2500 stake (25% of total)
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        2500n,
      );

      // User meets competition requirement
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.isEligible).toBe(true);
      // Potential reward = (2500 * 4000) / 10000 = 1000
      expect(result.potentialReward).toBe(1000n);
    });

    it("should use specified airdrop number when provided", async () => {
      const activitySeason = {
        startsWithAirdrop: 2,
        number: 3,
        name: "Season 3",
        startDate: new Date("2025-04-01T00:00:00Z"),
        endDate: new Date("2025-06-30T23:59:59Z"),
      };

      // When airdrop 3 is specified, activity is checked for season with airdrop 2
      mockAirdropRepository.getSeasonStartingWithAirdrop.mockResolvedValue(
        activitySeason,
      );

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        1000n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress, 3);

      expect(result.airdrop).toBe(3);
      expect(result.activitySeason.number).toBe(3);
      expect(
        mockAirdropRepository.getSeasonStartingWithAirdrop,
      ).toHaveBeenCalledWith(2); // airdrop - 1
    });

    it("should throw error when no current season found", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(null);

      await expect(
        service.getNextAirdropEligibility(mockAddress),
      ).rejects.toThrow(
        "No current season found based on current date. Check that season date ranges cover the current time.",
      );
    });

    it("should throw error when specified activity season not found", async () => {
      mockAirdropRepository.getSeasonStartingWithAirdrop.mockResolvedValue(
        null,
      );

      await expect(
        service.getNextAirdropEligibility(mockAddress, 5),
      ).rejects.toThrow("Activity season airdrop 4 not found");
    });

    it("should handle zero available rewards pool", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      // Already claimed more than forfeited
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        2000n,
      );

      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        1000n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.isEligible).toBe(true);
      expect(result.poolStats.availableRewardsPool).toBe(0n); // Capped at 0
      expect(result.potentialReward).toBe(0n);
    });

    it("should normalize address to lowercase", async () => {
      const upperCaseAddress = "0xABCDEF1234567890123456789012345678901234";

      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);
      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      await service.getNextAirdropEligibility(upperCaseAddress);

      expect(
        mockConvictionClaimsRepository.getActiveStakeForAccount,
      ).toHaveBeenCalledWith(
        upperCaseAddress.toLowerCase(),
        mockSeason.endDate,
      );
      expect(
        mockBoostRepository.getCompetitionIdsBoostedDuringSeason,
      ).toHaveBeenCalledWith(
        upperCaseAddress.toLowerCase(),
        mockSeason.startDate,
        mockSeason.endDate,
      );
    });

    it("should handle errors gracefully", async () => {
      const error = new Error("Database connection failed");
      mockAirdropRepository.getCurrentSeason.mockRejectedValue(error);

      await expect(
        service.getNextAirdropEligibility(mockAddress),
      ).rejects.toThrow("Database connection failed");

      expect(mockLogger.error).toHaveBeenCalledWith(
        { error },
        `Error calculating eligibility for address ${mockAddress}`,
      );
    });
  });

  describe("calculatePoolStats (via getNextAirdropEligibility)", () => {
    const mockAddress = "0x1234567890123456789012345678901234567890";
    const mockSeason = {
      startsWithAirdrop: 2,
      number: 3,
      name: "Season 3",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-03-31T23:59:59Z"),
    };

    it("should calculate pool stats correctly", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        50000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        20000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.poolStats.totalActiveStakes).toBe(50000n);
      expect(result.poolStats.totalForfeited).toBe(20000n);
      expect(result.poolStats.totalAlreadyClaimed).toBe(5000n);
      expect(result.poolStats.availableRewardsPool).toBe(15000n); // 20000 - 5000
    });

    it("should call getTotalConvictionRewardsClaimedBySeason with correct season range", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      await service.getNextAirdropEligibility(mockAddress);

      // Should query from season 1 to current startsWithAirdrop (2)
      expect(
        mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason,
      ).toHaveBeenCalledWith(1, mockSeason.startsWithAirdrop);
    });

    it("should use season end date for active stakes query", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      await service.getNextAirdropEligibility(mockAddress);

      expect(
        mockConvictionClaimsRepository.getTotalActiveStakesForSeason,
      ).toHaveBeenCalledWith(mockSeason.endDate);
      expect(
        mockConvictionClaimsRepository.getTotalForfeitedUpToDate,
      ).toHaveBeenCalledWith(mockSeason.endDate);
    });

    it("should cap available rewards pool at zero when negative", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      // Forfeited less than already claimed
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        3000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      // 3000 - 5000 = -2000, but should be capped at 0
      expect(result.poolStats.availableRewardsPool).toBe(0n);
    });

    it("should handle large numbers correctly", async () => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);

      const largeStakes = BigInt("999999999999999999999999999999");
      const largeForfeited = BigInt("500000000000000000000000000000");
      const largeClaimed = BigInt("100000000000000000000000000000");

      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        largeStakes,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        largeForfeited,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        largeClaimed,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        0n,
      );
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.poolStats.totalActiveStakes).toBe(largeStakes);
      expect(result.poolStats.totalForfeited).toBe(largeForfeited);
      expect(result.poolStats.totalAlreadyClaimed).toBe(largeClaimed);
      expect(result.poolStats.availableRewardsPool).toBe(
        largeForfeited - largeClaimed,
      );
    });
  });

  describe("checkEligibilityReasons (via getNextAirdropEligibility)", () => {
    const mockAddress = "0x1234567890123456789012345678901234567890";
    const mockSeason = {
      startsWithAirdrop: 1,
      number: 2,
      name: "Season 2",
      startDate: new Date("2025-01-01T00:00:00Z"),
      endDate: new Date("2025-03-31T23:59:59Z"),
    };

    beforeEach(() => {
      mockAirdropRepository.getCurrentSeason.mockResolvedValue(mockSeason);
      mockConvictionClaimsRepository.getTotalActiveStakesForSeason.mockResolvedValue(
        10000n,
      );
      mockConvictionClaimsRepository.getTotalForfeitedUpToDate.mockResolvedValue(
        5000n,
      );
      mockConvictionClaimsRepository.getTotalConvictionRewardsClaimedBySeason.mockResolvedValue(
        1000n,
      );
      mockConvictionClaimsRepository.getActiveStakeForAccount.mockResolvedValue(
        1000n,
      );
    });

    it("should count unique competitions from both boosting and competing", async () => {
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-3", "comp-4"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(4);
      expect(result.eligibilityReasons.boostedCompetitionIds).toEqual([
        "comp-1",
        "comp-2",
      ]);
      expect(result.eligibilityReasons.competedCompetitionIds).toEqual([
        "comp-3",
        "comp-4",
      ]);
    });

    it("should deduplicate competitions that appear in both boosting and competing", async () => {
      // Overlapping competitions
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-2", "comp-3", "comp-4"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      // Total unique: comp-1, comp-2, comp-3, comp-4 = 4
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(4);
      expect(result.eligibilityReasons.hasBoostedAgents).toBe(true);
      expect(result.eligibilityReasons.hasCompetedInCompetitions).toBe(true);
    });

    it("should set hasBoostedAgents to true when user has boosted", async () => {
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.hasBoostedAgents).toBe(true);
      expect(result.eligibilityReasons.hasCompetedInCompetitions).toBe(false);
    });

    it("should set hasCompetedInCompetitions to true when user has competed", async () => {
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-1"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.hasBoostedAgents).toBe(false);
      expect(result.eligibilityReasons.hasCompetedInCompetitions).toBe(true);
    });

    it("should set both flags to false when user has no activity", async () => {
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.hasBoostedAgents).toBe(false);
      expect(result.eligibilityReasons.hasCompetedInCompetitions).toBe(false);
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(0);
    });

    it("should query boost and competition repos with correct season dates", async () => {
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        [],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        [],
      );

      await service.getNextAirdropEligibility(mockAddress);

      expect(
        mockBoostRepository.getCompetitionIdsBoostedDuringSeason,
      ).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        mockSeason.startDate,
        mockSeason.endDate,
      );
      expect(
        mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason,
      ).toHaveBeenCalledWith(
        mockAddress.toLowerCase(),
        mockSeason.startDate,
        mockSeason.endDate,
      );
    });

    it("should be eligible with exactly minimum competitions required", async () => {
      // Default minimum is 3
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-3"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(3);
      expect(result.isEligible).toBe(true);
    });

    it("should be ineligible with one less than minimum competitions", async () => {
      // Default minimum is 3, so 2 competitions should be ineligible
      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-2"],
      );

      const result = await service.getNextAirdropEligibility(mockAddress);

      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(2);
      expect(result.isEligible).toBe(false);
    });

    it("should respect custom minCompetitionsForEligibility", async () => {
      // Create service with custom minimum of 5
      const customService = new AirdropService(
        mockAirdropRepository,
        mockLogger,
        mockConvictionClaimsRepository,
        mockBoostRepository,
        mockCompetitionRepository,
        5, // Custom minimum
      );

      mockBoostRepository.getCompetitionIdsBoostedDuringSeason.mockResolvedValue(
        ["comp-1", "comp-2", "comp-3"],
      );
      mockCompetitionRepository.getCompetitionIdsCompetedDuringSeason.mockResolvedValue(
        ["comp-4"],
      );

      const result = await customService.getNextAirdropEligibility(mockAddress);

      // 4 competitions, but need 5
      expect(result.eligibilityReasons.totalUniqueCompetitions).toBe(4);
      expect(result.isEligible).toBe(false);
    });
  });
});
