import { beforeEach, describe, expect, it, vi } from "vitest";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";
import { ConvictionClaimsRepository } from "@recallnet/db/repositories/conviction-claims";

import { AirdropService, ClaimData } from "../airdrop.service";

describe("AirdropService", () => {
  let service: AirdropService;
  let mockAirdropRepository: any;
  let mockConvictionClaimsRepository: any;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    mockAirdropRepository = {
      getAllClaimsForAddress: vi.fn(),
      getClaimByAddress: vi.fn(),
      getClaimStatus: vi.fn(),
      updateClaimStatus: vi.fn(),
    };

    mockConvictionClaimsRepository = {
      getClaimsByAccount: vi.fn(),
      getClaimByAccountAndSeason: vi.fn(),
      hasClaimedForSeason: vi.fn(),
      getTotalClaimedByAccount: vi.fn(),
    };

    service = new AirdropService(
      mockAirdropRepository as AirdropRepository,
      mockLogger,
      mockConvictionClaimsRepository as ConvictionClaimsRepository,
    );
  });

  describe("getAccountClaimsData", () => {
    it("should return claims data for an address with allocations and no claims", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
        ],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        season: 1,
        seasonName: "Season 1",
        allocation: {
          amount: BigInt("2000000000000000000"),
          proof: ["0xproof3", "0xproof4"],
          ineligibleReason: undefined,
        },
        claim: {
          status: "available",
          claimedAmount: undefined,
          stakeDuration: undefined,
          unlocksAt: undefined,
        },
      });
      expect(result[1]).toEqual({
        season: 0,
        seasonName: "Genesis",
        allocation: {
          amount: BigInt("1000000000000000000"),
          proof: ["0xproof1", "0xproof2"],
          ineligibleReason: undefined,
        },
        claim: {
          status: "available",
          claimedAmount: undefined,
          stakeDuration: undefined,
          unlocksAt: undefined,
        },
      });
    });

    it("should return claims data with claimed tokens and staking info", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const claimTimestamp = new Date("2024-01-01T00:00:00Z");

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
        ],
        claimStatus: {
          address: mockAddress.toLowerCase(),
          claimed: true,
          claimedAt: claimTimestamp,
          transactionHash: "0xtxhash",
          stakingDuration: 30,
          stakedAmount: "1000000000000000000",
        },
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([
        {
          id: "claim-1",
          account: mockAddress.toLowerCase(),
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(2592000), // 30 days in seconds
          blockNumber: BigInt(1000000),
          blockTimestamp: claimTimestamp,
          transactionHash: Buffer.from("txhash"),
        },
      ]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      expect(result[0].season).toBe(0);
      expect(result[0].seasonName).toBe("Genesis");
      expect(result[0].allocation.amount).toBe(BigInt("1000000000000000000"));
      expect(result[0].claim.status).toBe("claimed");
      expect(result[0].claim.claimedAmount).toBe(BigInt("1000000000000000000"));
      expect(result[0].claim.stakeDuration).toBe(30); // 30 days
      expect(result[0].claim.unlocksAt).toEqual(
        new Date("2024-01-31T00:00:00Z"),
      );
    });

    it("should mark sybil accounts as ineligible", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
        ],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      expect(result[0].allocation.ineligibleReason).toBe(
        "Suspicious activity detected",
      );
      expect(result[0].claim.status).toBe("expired");
    });

    it("should mark maybe-sybil accounts with review message", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
          {
            address: mockAddress.toLowerCase(),
            amount: BigInt("1000000000000000000"),
            season: 0,
            proof: ["0xproof1", "0xproof2"],
            category: "early",
            sybilClassification: "maybe-sybil",
            flaggedAt: null,
            flaggingReason: null,
            powerUser: false,
            recallSnapper: false,
            aiBuilder: false,
            aiExplorer: false,
          },
        ],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      expect(result[0].allocation.ineligibleReason).toBe(
        "Account under review for potential sybil activity",
      );
      expect(result[0].claim.status).toBe("expired");
    });

    it("should handle multiple seasons with different claim statuses", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const claimTimestamp = new Date("2024-01-01T00:00:00Z");

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
        ],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([
        {
          id: "claim-1",
          account: mockAddress.toLowerCase(),
          eligibleAmount: BigInt("1000000000000000000"),
          claimedAmount: BigInt("1000000000000000000"),
          season: 0,
          duration: BigInt(0), // No staking
          blockNumber: BigInt(1000000),
          blockTimestamp: claimTimestamp,
          transactionHash: Buffer.from("txhash"),
        },
      ]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(3);

      // Check sorting (most recent season first)
      expect(result[0].season).toBe(2);
      expect(result[1].season).toBe(1);
      expect(result[2].season).toBe(0);

      // Season 2 - Sybil flagged
      expect(result[0].claim.status).toBe("expired");
      expect(result[0].allocation.ineligibleReason).toBe(
        "Account flagged as sybil",
      );

      // Season 1 - Available
      expect(result[1].claim.status).toBe("available");
      expect(result[1].allocation.ineligibleReason).toBeUndefined();

      // Season 0 - Claimed without staking
      expect(result[2].claim.status).toBe("claimed");
      expect(result[2].claim.claimedAmount).toBe(BigInt("1000000000000000000"));
      expect(result[2].claim.stakeDuration).toBe(0);
      expect(result[2].claim.unlocksAt).toBeUndefined();
    });

    it("should handle empty allocations", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(0);
    });

    it("should work without conviction claims repository", async () => {
      const serviceWithoutConviction = new AirdropService(
        mockAirdropRepository as AirdropRepository,
        mockLogger,
      );

      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
        ],
        claimStatus: null,
      });

      const result =
        await serviceWithoutConviction.getAccountClaimsData(mockAddress);

      expect(result).toHaveLength(1);
      expect(result[0].claim.status).toBe("available");
      expect(result[0].claim.claimedAmount).toBeUndefined();
    });

    it("should handle errors gracefully", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const error = new Error("Database connection failed");

      mockAirdropRepository.getAllClaimsForAddress.mockRejectedValue(error);

      await expect(service.getAccountClaimsData(mockAddress)).rejects.toThrow(
        "Database connection failed",
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        `Error fetching claims data for address ${mockAddress}:`,
        error,
      );
    });

    it("should assign correct season names", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";

      mockAirdropRepository.getAllClaimsForAddress.mockResolvedValue({
        claims: [
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
          },
          {
            address: mockAddress.toLowerCase(),
            amount: BigInt("1000"),
            season: 3,
            proof: [],
            category: "",
            sybilClassification: "approved",
            flaggedAt: null,
            flaggingReason: null,
            powerUser: false,
            recallSnapper: false,
            aiBuilder: false,
            aiExplorer: false,
          },
          {
            address: mockAddress.toLowerCase(),
            amount: BigInt("1000"),
            season: 99,
            proof: [],
            category: "",
            sybilClassification: "approved",
            flaggedAt: null,
            flaggingReason: null,
            powerUser: false,
            recallSnapper: false,
            aiBuilder: false,
            aiExplorer: false,
          },
        ],
        claimStatus: null,
      });

      mockConvictionClaimsRepository.getClaimsByAccount.mockResolvedValue([]);

      const result = await service.getAccountClaimsData(mockAddress);

      expect(result.find((c: ClaimData) => c.season === 0)?.seasonName).toBe(
        "Genesis",
      );
      expect(result.find((c: ClaimData) => c.season === 3)?.seasonName).toBe(
        "Season 3",
      );
      expect(result.find((c: ClaimData) => c.season === 99)?.seasonName).toBe(
        "Season 99",
      );
    });
  });

  describe("checkEligibility", () => {
    it("should check eligibility for an address", async () => {
      const mockAddress = "0x1234567890123456789012345678901234567890";
      const mockSeason = 0;
      const mockClaim = {
        address: mockAddress.toLowerCase(),
        amount: BigInt("1000000000000000000"),
        season: 0,
        proof: ["0xproof1"],
        category: "early",
        sybilClassification: "approved",
      };

      mockAirdropRepository.getClaimByAddress.mockResolvedValue(mockClaim);

      const result = await service.checkEligibility(mockAddress, mockSeason);

      expect(result).toEqual(mockClaim);
      expect(mockAirdropRepository.getClaimByAddress).toHaveBeenCalledWith(
        mockAddress,
      );
    });
  });
});
