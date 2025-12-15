import { Logger } from "pino";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { EigenaiRepository } from "@recallnet/db/repositories/eigenai";

import { EigenaiService } from "../eigenai.service.js";

// =============================================================================
// STATIC TEST FIXTURES - Captured from live EigenAI API (2025-12-09)
// These are real cryptographic signatures that can be deterministically verified
// =============================================================================

const EIGENAI_TEST_FIXTURE = {
  requestMessages: [
    {
      role: "user",
      content: "Say hello in exactly 5 words.",
    },
  ],
  responseModel: "gpt-oss-120b-f16",
  fullPrompt: "Say hello in exactly 5 words.",
  fullOutput:
    '<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  signature:
    "5dc80dc47e71cbd4bf1d8d86e28b1919b42719c5a5cbf548811dd3f73702aac11b0e10ed3f11da2890e784ae056c163655b1fe00c0e2c8c0a4fd6a9777140c8f1b",
  chainId: "1",
  expectedSigner: "0x7053bfb0433a16a2405de785d547b1b32cee0cf3",
  reconstructedMessage:
    '1gpt-oss-120b-f16Say hello in exactly 5 words.<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  verificationPassed: true,
  recoveredAddress: "0x7053bfb0433a16a2405De785D547B1B32CeE0cF3",
} as const;

const EIGENAI_INVALID_SIGNATURE_FIXTURE = {
  requestMessages: [
    {
      role: "user",
      content: "Say hello in exactly 5 words.",
    },
  ],
  responseModel: "gpt-oss-120b-f16",
  fullPrompt: "Say hello in exactly 5 words.",
  fullOutput:
    '<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  // Corrupted signature (last 8 chars changed to deadbeef)
  signature:
    "5dc80dc47e71cbd4bf1d8d86e28b1919b42719c5a5cbf548811dd3f73702aac11b0e10ed3f11da2890e784ae056c163655b1fe00c0e2c8c0a4fd6a9777deadbeef",
  chainId: "1",
  expectedSigner: "0x7053bfb0433a16a2405de785d547b1b32cee0cf3",
  verificationPassed: false,
} as const;

const EIGENAI_WRONG_SIGNER_FIXTURE = {
  requestMessages: [
    {
      role: "user",
      content: "Say hello in exactly 5 words.",
    },
  ],
  responseModel: "gpt-oss-120b-f16",
  fullPrompt: "Say hello in exactly 5 words.",
  fullOutput:
    '<|channel|>analysis<|message|>User asks: "Say hello in exactly 5 words." Need to output a greeting consisting of exactly five words. Must be exactly 5 words, like "Hello, dear friend, welcome!" That\'s 4? Let\'s count. "Hello dear friend welcome" 4. Need 5 words. Example: "Hello dear friend, welcome today!" Count: Hello(1) dear(2) friend,(3) welcome(4) today!(5). That\'s five words. Ensure punctuation doesn\'t affect word count. Provide exactly that.<|end|>Hello dear friend, welcome today!',
  // Valid signature but wrong expected signer
  signature:
    "5dc80dc47e71cbd4bf1d8d86e28b1919b42719c5a5cbf548811dd3f73702aac11b0e10ed3f11da2890e784ae056c163655b1fe00c0e2c8c0a4fd6a9777140c8f1b",
  chainId: "1",
  expectedSigner: "0x0000000000000000000000000000000000000001", // Wrong signer
  recoveredAddress: "0x7053bfb0433a16a2405De785D547B1B32CeE0cF3", // Real signer
  verificationPassed: false,
} as const;

// =============================================================================
// MOCK SETUP
// =============================================================================

// Mock logger
const mockLogger: Logger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn().mockReturnThis(),
} as unknown as Logger;

// Mock repository with all methods from EigenaiRepository
const createMockRepository = () => ({
  createSignatureSubmission: vi.fn(),
  batchCreateSignatureSubmissions: vi.fn(),
  getAgentSubmissions: vi.fn(),
  getCompetitionSubmissions: vi.fn(),
  countVerifiedSubmissionsSince: vi.fn(),
  getBadgeRefreshData: vi.fn(),
  getBadgeStatus: vi.fn(),
  upsertBadgeStatus: vi.fn(),
  batchUpsertBadgeStatuses: vi.fn(),
  getActiveBadgesForCompetition: vi.fn(),
  getAllBadgeStatusesForCompetition: vi.fn(),
  getBadgeStatusesForAgent: vi.fn(),
  getBulkAgentBadgeStatuses: vi.fn(),
  getCompetitionBadgeStats: vi.fn(),
  isAgentBadgeActive: vi.fn(),
});

type MockRepository = ReturnType<typeof createMockRepository>;

// =============================================================================
// TESTS
// =============================================================================

describe("EigenaiService", () => {
  describe("verifySignature (cryptographic verification with real data)", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();

      // Create service with real EigenAI config
      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should verify valid EigenAI signature from real API response", async () => {
      // This test uses REAL cryptographic data - no mocking of viem
      const result = await service.verifySignature(
        EIGENAI_TEST_FIXTURE.fullPrompt,
        EIGENAI_TEST_FIXTURE.responseModel,
        EIGENAI_TEST_FIXTURE.fullOutput,
        EIGENAI_TEST_FIXTURE.signature,
      );

      expect(result.isValid).toBe(true);
      expect(result.status).toBe("verified");
      expect(result.recoveredAddress?.toLowerCase()).toBe(
        EIGENAI_TEST_FIXTURE.expectedSigner.toLowerCase(),
      );
    });

    test("should reject corrupted signature", async () => {
      const result = await service.verifySignature(
        EIGENAI_INVALID_SIGNATURE_FIXTURE.fullPrompt,
        EIGENAI_INVALID_SIGNATURE_FIXTURE.responseModel,
        EIGENAI_INVALID_SIGNATURE_FIXTURE.fullOutput,
        EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
      );

      // Corrupted signature will either:
      // 1. Fail to recover (throw error -> isValid = false)
      // 2. Recover a different address (isValid = false)
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("invalid");
    });

    test("should reject signature when signer does not match", async () => {
      // Create service with WRONG expected signer
      const serviceWithWrongSigner = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_WRONG_SIGNER_FIXTURE.chainId,
            expectedSigners: [EIGENAI_WRONG_SIGNER_FIXTURE.expectedSigner], // 0x0000...0001
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );

      const result = await serviceWithWrongSigner.verifySignature(
        EIGENAI_WRONG_SIGNER_FIXTURE.fullPrompt,
        EIGENAI_WRONG_SIGNER_FIXTURE.responseModel,
        EIGENAI_WRONG_SIGNER_FIXTURE.fullOutput,
        EIGENAI_WRONG_SIGNER_FIXTURE.signature,
      );

      // Signature is valid but signer doesn't match expected
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("invalid");
      // Should recover the real signer address
      expect(result.recoveredAddress?.toLowerCase()).toBe(
        EIGENAI_WRONG_SIGNER_FIXTURE.recoveredAddress.toLowerCase(),
      );
    });

    test("should reject signature with modified prompt (message tampering)", async () => {
      const result = await service.verifySignature(
        "TAMPERED PROMPT - not original", // Modified prompt
        EIGENAI_TEST_FIXTURE.responseModel,
        EIGENAI_TEST_FIXTURE.fullOutput,
        EIGENAI_TEST_FIXTURE.signature,
      );

      // Message was tampered - signature won't verify
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("invalid");
    });

    test("should reject signature with modified output (response tampering)", async () => {
      const result = await service.verifySignature(
        EIGENAI_TEST_FIXTURE.fullPrompt,
        EIGENAI_TEST_FIXTURE.responseModel,
        "TAMPERED OUTPUT - fake response", // Modified output
        EIGENAI_TEST_FIXTURE.signature,
      );

      // Message was tampered - signature won't verify
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("invalid");
    });

    test("should reject signature with wrong model ID", async () => {
      const result = await service.verifySignature(
        EIGENAI_TEST_FIXTURE.fullPrompt,
        "wrong-model-id", // Wrong model
        EIGENAI_TEST_FIXTURE.fullOutput,
        EIGENAI_TEST_FIXTURE.signature,
      );

      // Message reconstruction is wrong - signature won't verify
      expect(result.isValid).toBe(false);
      expect(result.status).toBe("invalid");
    });

    test("should handle signature without 0x prefix", async () => {
      // Fixture already has no prefix - verify it works
      const signatureWithoutPrefix = EIGENAI_TEST_FIXTURE.signature.replace(
        /^0x/,
        "",
      );

      const result = await service.verifySignature(
        EIGENAI_TEST_FIXTURE.fullPrompt,
        EIGENAI_TEST_FIXTURE.responseModel,
        EIGENAI_TEST_FIXTURE.fullOutput,
        signatureWithoutPrefix,
      );

      expect(result.isValid).toBe(true);
      expect(result.status).toBe("verified");
    });

    test("should handle signature with 0x prefix", async () => {
      // Add 0x prefix
      const signatureWithPrefix = `0x${EIGENAI_TEST_FIXTURE.signature.replace(/^0x/, "")}`;

      const result = await service.verifySignature(
        EIGENAI_TEST_FIXTURE.fullPrompt,
        EIGENAI_TEST_FIXTURE.responseModel,
        EIGENAI_TEST_FIXTURE.fullOutput,
        signatureWithPrefix,
      );

      expect(result.isValid).toBe(true);
      expect(result.status).toBe("verified");
    });
  });

  describe("submitSignature", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();

      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should store verified submission and return success", async () => {
      const mockSubmission = {
        id: "submission-123",
        agentId: "agent-456",
        competitionId: "comp-789",
        signature: EIGENAI_TEST_FIXTURE.signature,
        chainId: EIGENAI_TEST_FIXTURE.chainId,
        requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
        responseModel: EIGENAI_TEST_FIXTURE.responseModel,
        responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
        verificationStatus: "verified" as const,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSignatureSubmission.mockResolvedValue(
        mockSubmission,
      );
      mockRepository.getBadgeStatus.mockResolvedValue({
        agentId: "agent-456",
        competitionId: "comp-789",
        isBadgeActive: true,
        signaturesLast24h: 15,
        lastVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepository.countVerifiedSubmissionsSince.mockResolvedValue(15);
      mockRepository.upsertBadgeStatus.mockResolvedValue({
        agentId: "agent-456",
        competitionId: "comp-789",
        isBadgeActive: true,
        signaturesLast24h: 15,
        lastVerifiedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.submitSignature({
        agentId: "agent-456",
        competitionId: "comp-789",
        signature: EIGENAI_TEST_FIXTURE.signature,
        responseModel: EIGENAI_TEST_FIXTURE.responseModel,
        requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
        responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
      });

      expect(result.verified).toBe(true);
      expect(result.submission.id).toBe("submission-123");
      expect(mockRepository.createSignatureSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: "agent-456",
          competitionId: "comp-789",
          signature: EIGENAI_TEST_FIXTURE.signature,
          verificationStatus: "verified",
        }),
      );
    });

    test("should store invalid submission and return failure", async () => {
      const mockSubmission = {
        id: "submission-123",
        agentId: "agent-456",
        competitionId: "comp-789",
        signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
        chainId: EIGENAI_TEST_FIXTURE.chainId,
        requestPrompt: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullPrompt,
        responseModel: EIGENAI_INVALID_SIGNATURE_FIXTURE.responseModel,
        responseOutput: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullOutput,
        verificationStatus: "invalid" as const,
        submittedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.createSignatureSubmission.mockResolvedValue(
        mockSubmission,
      );
      mockRepository.getBadgeStatus.mockResolvedValue(null);

      const result = await service.submitSignature({
        agentId: "agent-456",
        competitionId: "comp-789",
        signature: EIGENAI_INVALID_SIGNATURE_FIXTURE.signature,
        responseModel: EIGENAI_INVALID_SIGNATURE_FIXTURE.responseModel,
        requestPrompt: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullPrompt,
        responseOutput: EIGENAI_INVALID_SIGNATURE_FIXTURE.fullOutput,
      });

      expect(result.verified).toBe(false);
      expect(mockRepository.createSignatureSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          verificationStatus: "invalid",
        }),
      );
    });

    test("should throw 409 error for duplicate signature submission", async () => {
      // Simulate PostgreSQL unique constraint violation (code 23505)
      const uniqueConstraintError = new Error("duplicate key value");
      (uniqueConstraintError as unknown as { code: string }).code = "23505";
      (uniqueConstraintError as unknown as { constraint: string }).constraint =
        "idx_sig_submissions_comp_signature_uniq";

      mockRepository.createSignatureSubmission.mockRejectedValue(
        uniqueConstraintError,
      );

      await expect(
        service.submitSignature({
          agentId: "agent-456",
          competitionId: "comp-789",
          signature: EIGENAI_TEST_FIXTURE.signature,
          responseModel: EIGENAI_TEST_FIXTURE.responseModel,
          requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
          responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
        }),
      ).rejects.toThrow(
        "This signature has already been submitted for this competition",
      );
    });

    test("should rethrow non-unique-constraint errors", async () => {
      const otherError = new Error("Database connection failed");

      mockRepository.createSignatureSubmission.mockRejectedValue(otherError);

      await expect(
        service.submitSignature({
          agentId: "agent-456",
          competitionId: "comp-789",
          signature: EIGENAI_TEST_FIXTURE.signature,
          responseModel: EIGENAI_TEST_FIXTURE.responseModel,
          requestPrompt: EIGENAI_TEST_FIXTURE.fullPrompt,
          responseOutput: EIGENAI_TEST_FIXTURE.fullOutput,
        }),
      ).rejects.toThrow("Database connection failed");
    });
  });

  describe("getAgentBadgeStatus", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();

      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should return badge status from repository", async () => {
      const mockStatus = {
        agentId: "agent-456",
        competitionId: "comp-789",
        isBadgeActive: true,
        signaturesLast24h: 15,
        lastVerifiedAt: new Date("2025-12-09T20:00:00Z"),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.getBadgeStatus.mockResolvedValue(mockStatus);

      const result = await service.getAgentBadgeStatus("agent-456", "comp-789");

      expect(result).toEqual({
        agentId: "agent-456",
        competitionId: "comp-789",
        isBadgeActive: true,
        signaturesLast24h: 15,
        lastVerifiedAt: mockStatus.lastVerifiedAt,
      });
    });

    test("should return null when no status exists", async () => {
      mockRepository.getBadgeStatus.mockResolvedValue(null);

      const result = await service.getAgentBadgeStatus("agent-456", "comp-789");

      expect(result).toBeNull();
    });
  });

  describe("refreshBadgeStatuses", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();

      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10, // Need 10 signatures for active badge
          },
        },
        mockLogger,
      );
    });

    test("should activate badge when agent meets threshold", async () => {
      // Agent has 15 verified signatures in last 24h (above threshold of 10)
      mockRepository.getBadgeRefreshData.mockResolvedValue([
        {
          agentId: "agent-456",
          competitionId: "comp-789",
          verifiedCount: 15,
          lastVerifiedAt: new Date(),
        },
      ]);

      mockRepository.batchUpsertBadgeStatuses.mockResolvedValue([
        {
          agentId: "agent-456",
          competitionId: "comp-789",
          isBadgeActive: true,
          signaturesLast24h: 15,
          lastVerifiedAt: new Date(),
        },
      ]);

      const result = await service.refreshBadgeStatuses("comp-789");

      expect(result).toBe(1);
      expect(mockRepository.batchUpsertBadgeStatuses).toHaveBeenCalledWith([
        expect.objectContaining({
          agentId: "agent-456",
          competitionId: "comp-789",
          isBadgeActive: true,
          signaturesLast24h: 15,
        }),
      ]);
    });

    test("should deactivate badge when agent falls below threshold", async () => {
      // Agent has 5 verified signatures (below threshold of 10)
      mockRepository.getBadgeRefreshData.mockResolvedValue([
        {
          agentId: "agent-456",
          competitionId: "comp-789",
          verifiedCount: 5,
          lastVerifiedAt: new Date(),
        },
      ]);

      mockRepository.batchUpsertBadgeStatuses.mockResolvedValue([
        {
          agentId: "agent-456",
          competitionId: "comp-789",
          isBadgeActive: false,
          signaturesLast24h: 5,
          lastVerifiedAt: new Date(),
        },
      ]);

      const result = await service.refreshBadgeStatuses("comp-789");

      expect(result).toBe(1);
      expect(mockRepository.batchUpsertBadgeStatuses).toHaveBeenCalledWith([
        expect.objectContaining({
          agentId: "agent-456",
          competitionId: "comp-789",
          isBadgeActive: false,
          signaturesLast24h: 5,
        }),
      ]);
    });

    test("should handle multiple agents in competition", async () => {
      mockRepository.getBadgeRefreshData.mockResolvedValue([
        {
          agentId: "agent-1",
          competitionId: "comp-789",
          verifiedCount: 15, // Above threshold
          lastVerifiedAt: new Date(),
        },
        {
          agentId: "agent-2",
          competitionId: "comp-789",
          verifiedCount: 3, // Below threshold
          lastVerifiedAt: new Date(),
        },
        {
          agentId: "agent-3",
          competitionId: "comp-789",
          verifiedCount: 10, // Exactly at threshold
          lastVerifiedAt: new Date(),
        },
      ]);

      mockRepository.batchUpsertBadgeStatuses.mockResolvedValue([
        { agentId: "agent-1" },
        { agentId: "agent-2" },
        { agentId: "agent-3" },
      ]);

      const result = await service.refreshBadgeStatuses("comp-789");

      expect(result).toBe(3);
      expect(mockRepository.batchUpsertBadgeStatuses).toHaveBeenCalledWith([
        expect.objectContaining({ agentId: "agent-1", isBadgeActive: true }),
        expect.objectContaining({ agentId: "agent-2", isBadgeActive: false }),
        expect.objectContaining({ agentId: "agent-3", isBadgeActive: true }),
      ]);
    });

    test("should return 0 when no agents have submissions", async () => {
      mockRepository.getBadgeRefreshData.mockResolvedValue([]);

      const result = await service.refreshBadgeStatuses("comp-789");

      expect(result).toBe(0);
      expect(mockRepository.batchUpsertBadgeStatuses).not.toHaveBeenCalled();
    });
  });

  describe("getAgentSubmissions", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();

      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should return paginated submission history", async () => {
      const mockSubmissions = {
        submissions: [
          {
            id: "sub-1",
            agentId: "agent-456",
            competitionId: "comp-789",
            signature: "sig-1",
            verificationStatus: "verified" as const,
            submittedAt: new Date(),
          },
          {
            id: "sub-2",
            agentId: "agent-456",
            competitionId: "comp-789",
            signature: "sig-2",
            verificationStatus: "verified" as const,
            submittedAt: new Date(),
          },
        ],
        total: 25,
      };

      mockRepository.getAgentSubmissions.mockResolvedValue(mockSubmissions);

      const result = await service.getAgentSubmissions(
        "agent-456",
        "comp-789",
        { limit: 10, offset: 0 },
      );

      expect(result.submissions).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(mockRepository.getAgentSubmissions).toHaveBeenCalledWith(
        "agent-456",
        "comp-789",
        { limit: 10, offset: 0 },
      );
    });
  });

  describe("getAllBadgeStatusesForCompetition", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();
      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should return all badge statuses for a competition", async () => {
      const mockStatuses = [
        {
          agentId: "agent-1",
          competitionId: "comp-789",
          isBadgeActive: true,
          signaturesLast24h: 15,
          lastVerifiedAt: new Date("2025-12-09T20:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          agentId: "agent-2",
          competitionId: "comp-789",
          isBadgeActive: false,
          signaturesLast24h: 3,
          lastVerifiedAt: new Date("2025-12-09T18:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getAllBadgeStatusesForCompetition.mockResolvedValue(
        mockStatuses,
      );

      const result =
        await service.getAllBadgeStatusesForCompetition("comp-789");

      expect(result).toHaveLength(2);
      expect(result[0]?.agentId).toBe("agent-1");
      expect(result[0]?.isBadgeActive).toBe(true);
      expect(result[1]?.agentId).toBe("agent-2");
      expect(result[1]?.isBadgeActive).toBe(false);
    });

    test("should return empty array when no statuses exist", async () => {
      mockRepository.getAllBadgeStatusesForCompetition.mockResolvedValue([]);

      const result =
        await service.getAllBadgeStatusesForCompetition("comp-789");

      expect(result).toHaveLength(0);
    });
  });

  describe("getBadgeStatusesForAgent", () => {
    let service: EigenaiService;
    let mockRepository: MockRepository;

    beforeEach(() => {
      mockRepository = createMockRepository();
      service = new EigenaiService(
        mockRepository as unknown as EigenaiRepository,
        {
          eigenai: {
            chainId: EIGENAI_TEST_FIXTURE.chainId,
            expectedSigners: [EIGENAI_TEST_FIXTURE.expectedSigner],
            badgeActiveThreshold: 10,
          },
        },
        mockLogger,
      );
    });

    test("should return all badge statuses for an agent across competitions", async () => {
      const mockStatuses = [
        {
          agentId: "agent-456",
          competitionId: "comp-1",
          isBadgeActive: true,
          signaturesLast24h: 15,
          lastVerifiedAt: new Date("2025-12-09T20:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          agentId: "agent-456",
          competitionId: "comp-2",
          isBadgeActive: false,
          signaturesLast24h: 5,
          lastVerifiedAt: new Date("2025-12-08T10:00:00Z"),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockRepository.getBadgeStatusesForAgent.mockResolvedValue(mockStatuses);

      const result = await service.getBadgeStatusesForAgent("agent-456");

      expect(result).toHaveLength(2);
      expect(result[0]?.competitionId).toBe("comp-1");
      expect(result[0]?.isBadgeActive).toBe(true);
      expect(result[1]?.competitionId).toBe("comp-2");
      expect(result[1]?.isBadgeActive).toBe(false);
    });

    test("should return empty array when agent has no badge statuses", async () => {
      mockRepository.getBadgeStatusesForAgent.mockResolvedValue([]);

      const result = await service.getBadgeStatusesForAgent("agent-456");

      expect(result).toHaveLength(0);
    });
  });
});
