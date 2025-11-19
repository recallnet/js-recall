import { Logger } from "pino";
import { beforeEach, describe, expect, it } from "vitest";
import { DeepMockProxy, mockDeep } from "vitest-mock-extended";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";

import { AirdropService, ClaimData } from "../airdrop.service.js";

describe("AirdropService", () => {
  let service: AirdropService;
  let mockAirdropRepository: DeepMockProxy<AirdropRepository>;
  let mockConvictionClaimsRepository: DeepMockProxy<ConvictionClaimsRepository>;
  let mockLogger: DeepMockProxy<Logger>;

  beforeEach(() => {
    mockLogger = mockDeep<Logger>();
    mockAirdropRepository = mockDeep<AirdropRepository>();
    mockConvictionClaimsRepository = mockDeep<ConvictionClaimsRepository>();

    service = new AirdropService(
      mockAirdropRepository,
      mockLogger,
      mockConvictionClaimsRepository,
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: season0Start,
          endDate: null,
        },
        {
          id: 2,
          number: 1,
          name: "Season 1",
          startDate: season1Start,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
          season: 1,
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
      expect(firstClaim.season).toBe(1);
      expect(firstClaim.seasonName).toBe("Season 1");
      if (firstClaim.type === "available") {
        expect(firstClaim.eligibleAmount).toBe(BigInt("2000000000000000000"));
        expect(firstClaim.proof).toEqual(["0xproof3", "0xproof4"]);
        expect(firstClaim.expiresAt).toBeDefined();
      }

      // Season 0 is now available during Season 1 (following season has not ended)
      const secondClaim = result[1]!;
      expect(secondClaim.type).toBe("available");
      expect(secondClaim.season).toBe(0);
      expect(secondClaim.seasonName).toBe("Genesis");
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: season0Start,
          endDate: null,
        },
        {
          id: 2,
          number: 1,
          name: "Season 1",
          startDate: season1Start,
          endDate: null,
        },
        {
          id: 3,
          number: 2,
          name: "Season 2",
          startDate: season2Start,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
          season: 1,
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
          season: 2,
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
      expect(result[0]!.season).toBe(2);
      expect(result[1]!.season).toBe(1);
      expect(result[2]!.season).toBe(0);

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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-12-31"),
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
      expect(claim.season).toBe(0);
      expect(claim.seasonName).toBe("Genesis");
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: null,
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: new Date("2024-01-01"),
          endDate: new Date("2025-01-01"),
        },
        {
          id: 2,
          number: 1,
          name: "Season 1",
          startDate: new Date("2025-01-01"),
          endDate: new Date("2026-01-01"),
        },
        {
          id: 3,
          number: 2,
          name: "Season 2",
          startDate: new Date("2026-01-01"),
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000"),
          season: 0,
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
          season: 1,
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
          season: 2,
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

      expect(result.find((c: ClaimData) => c.season === 0)?.seasonName).toBe(
        "Genesis",
      );
      expect(result.find((c: ClaimData) => c.season === 1)?.seasonName).toBe(
        "Season 1",
      );
      expect(result.find((c: ClaimData) => c.season === 2)?.seasonName).toBe(
        "Season 2",
      );
    });

    it("should mark unclaimed allocation as expired when 90 days past season start for season 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const seasonStartDate = new Date("2023-01-01");
      const expectedExpiryDate = new Date("2023-04-01"); // 90 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: seasonStartDate,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
      expect(claim.season).toBe(0);
      expect(claim.seasonName).toBe("Genesis");
      if (claim.type === "expired") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiredAt).toEqual(expectedExpiryDate);
      }
    });

    it("should mark allocation as expired when 30 days past season start for season > 0", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const seasonStartDate = new Date("2023-01-01");
      const expectedExpiryDate = new Date("2023-01-31"); // 30 days after season start

      mockAirdropRepository.getSeasons.mockResolvedValue([
        {
          id: 2,
          number: 1,
          name: "Season 1",
          startDate: seasonStartDate,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 1,
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
      expect(claim.season).toBe(1);
      expect(claim.seasonName).toBe("Season 1");
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
          id: 1,
          number: 0,
          name: "Genesis",
          startDate: seasonStartDate,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 0,
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
      expect(claim.season).toBe(0);
      expect(claim.seasonName).toBe("Genesis");
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
          id: 2,
          number: 1,
          name: "Season 1",
          startDate: seasonStartDate,
          endDate: null,
        },
      ]);

      mockAirdropRepository.getAllAllocationsForAddress.mockResolvedValue([
        {
          address: mockAddress.toLowerCase(),
          amount: BigInt("1000000000000000000"),
          season: 1,
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
      expect(claim.season).toBe(1);
      expect(claim.seasonName).toBe("Season 1");
      if (claim.type === "available") {
        expect(claim.eligibleAmount).toBe(BigInt("1000000000000000000"));
        expect(claim.expiresAt).toEqual(expectedExpiryDate);
      }
    });
  });
});
