import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, test } from "vitest";

import {
  competitionConfigurations,
  competitionInitialBalances,
} from "@recallnet/db-schema/trading/defs";

import { config } from "@/config/index.js";
import { db } from "@/database/db.js";
import {
  BalancesResponse,
  BlockchainType,
  CompetitionConfiguration,
  CompetitionRulesResponse,
  CreateCompetitionResponse,
  InitialBalance,
  SpecificChain,
  StartCompetitionResponse,
} from "@/e2e/utils/api-types.js";
import {
  createTestClient,
  getAdminApiKey,
  registerUserAndAgentAndGetClient,
  startTestCompetition,
  wait,
} from "@/e2e/utils/test-helpers.js";

describe("Competition Configuration (Stateless)", () => {
  let adminApiKey: string;

  beforeEach(async () => {
    adminApiKey = await getAdminApiKey();
  });

  describe("Competition Configuration", () => {
    test("should create competition with custom configuration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const customConfig: CompetitionConfiguration = {
        maxTradePercentage: 15, // 15% max trade size
      };

      const result = await adminClient.createCompetition(
        `Config Test Competition ${Date.now()}`,
        "Test competition with custom configuration",
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // endDate
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // joinStartDate
        undefined, // joinEndDate
        undefined, // maxParticipants
        undefined, // tradingConstraints
        undefined, // rewards
        customConfig,
      );

      expect(result.success).toBe(true);
      const competition = (result as CreateCompetitionResponse).competition;
      expect(competition).toBeDefined();

      // Verify configuration was stored in database
      const [storedConfig] = await db
        .select()
        .from(competitionConfigurations)
        .where(eq(competitionConfigurations.competitionId, competition.id));

      expect(storedConfig).toBeDefined();
      expect(storedConfig!.maxTradePercentage).toBe(15);
    });

    test("should use default configuration when not specified", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const result = await adminClient.createCompetition(
        `Default Config Competition ${Date.now()}`,
        "Test competition with default configuration",
      );

      expect(result.success).toBe(true);
      const competition = (result as CreateCompetitionResponse).competition;

      // Start the competition to make it active
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Default Config Agent",
      });

      await adminClient.request("post", "/api/admin/competition/start", {
        competitionId: competition.id,
        agentIds: [agent.id],
      });

      // Get competition rules to verify defaults
      const rulesResponse = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${competition.id}/rules`,
      );

      if ("error" in rulesResponse) {
        throw new Error(`Failed to get rules: ${rulesResponse.error}`);
      }

      const rules = rulesResponse.rules;

      // Verify default values are reflected in rules
      expect(rules.tradingRules).toContain(
        `Maximum single trade: ${config.maxTradePercentage}% of agent's total portfolio value`,
      );
    });

    test("should update competition configuration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Create competition first
      const createResult = await adminClient.createCompetition(
        `Update Config Test ${Date.now()}`,
        "Competition to test configuration updates",
      );

      expect(createResult.success).toBe(true);
      const competition = (createResult as CreateCompetitionResponse)
        .competition;

      // Update with new configuration
      const updatedConfig: CompetitionConfiguration = {
        maxTradePercentage: 30, // 30% max trade size
      };

      const updateResponse =
        await adminClient.request<CreateCompetitionResponse>(
          "put",
          `/api/admin/competition/${competition.id}`,
          {
            competitionConfiguration: updatedConfig,
          },
        );

      if ("error" in updateResponse) {
        throw new Error(
          `Failed to update competition: ${updateResponse.error}`,
        );
      }
      expect(updateResponse.success).toBe(true);

      // Wait a bit for the update to be processed
      await wait(100);

      // Verify configuration was updated
      const [storedConfig] = await db
        .select()
        .from(competitionConfigurations)
        .where(eq(competitionConfigurations.competitionId, competition.id));

      expect(storedConfig).toBeDefined();
      expect(storedConfig!.maxTradePercentage).toBe(30);
    });

    test("should enforce max trade percentage from competition configuration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Config Trade Test Agent",
        });

      // Start competition with 10% max trade size
      const customConfig: CompetitionConfiguration = {
        maxTradePercentage: 10, // 10% max trade size
      };

      const startResult = await adminClient.startCompetition({
        name: `Max Trade Test ${Date.now()}`,
        agentIds: [agent.id],
        competitionConfiguration: customConfig,
      });

      expect(startResult.success).toBe(true);

      // Get agent's initial balance
      const balanceResponse = await agentClient.getBalance();
      expect(balanceResponse.success).toBe(true);
      const balances = (balanceResponse as BalancesResponse).balances;

      // Find USDC balance
      const usdcBalance = balances.find(
        (b) => b.tokenAddress === config.specificChainTokens.svm.usdc,
      );
      expect(usdcBalance).toBeDefined();

      // Calculate total portfolio value to determine proper trade amount
      const totalPortfolioValue = balances.reduce(
        (sum, b) => sum + b.amount * b.price,
        0,
      );

      // Try to trade more than 10% of portfolio value
      // This should fail
      const largeTradeAmount = (
        (totalPortfolioValue * 0.15) /
        usdcBalance!.price
      ).toString(); // 15% of total portfolio value in USDC

      const tradeResponse = await agentClient.executeTrade({
        fromToken: config.specificChainTokens.svm.usdc,
        toToken: config.specificChainTokens.svm.sol,
        amount: largeTradeAmount,
        fromChain: BlockchainType.SVM,
        toChain: BlockchainType.SVM,
        reason: "Testing max trade percentage",
      });

      expect(tradeResponse.success).toBe(false);
      if ("error" in tradeResponse) {
        expect(tradeResponse.error).toContain("exceeds maximum size");
      } else {
        throw new Error("Expected error response");
      }
    });
  });

  describe("Initial Balances Configuration", () => {
    test("should create competition with custom initial balances", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const customBalances: InitialBalance[] = [
        {
          specificChain: "svm" as SpecificChain,
          tokenSymbol: "usdc",
          amount: 50000, // 50k USDC instead of default
        },
        {
          specificChain: "svm" as SpecificChain,
          tokenSymbol: "sol",
          amount: 100, // 100 SOL
        },
        {
          specificChain: "base" as SpecificChain,
          tokenSymbol: "usdc",
          amount: 25000, // 25k USDC on Base
        },
      ];

      const result = await adminClient.createCompetition(
        `Custom Balances Test ${Date.now()}`,
        "Test competition with custom initial balances",
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // endDate
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // joinStartDate
        undefined, // joinEndDate
        undefined, // maxParticipants
        undefined, // tradingConstraints
        undefined, // rewards
        undefined, // competitionConfiguration
        customBalances,
      );

      expect(result.success).toBe(true);
      const competition = (result as CreateCompetitionResponse).competition;

      // Verify balances were stored
      const storedBalances = await db
        .select()
        .from(competitionInitialBalances)
        .where(eq(competitionInitialBalances.competitionId, competition.id));

      expect(storedBalances).toHaveLength(3);

      const svmUsdcBalance = storedBalances.find(
        (b) => b.specificChain === "svm" && b.tokenSymbol === "usdc",
      );
      expect(svmUsdcBalance?.amount).toBe(50000);

      const svmSolBalance = storedBalances.find(
        (b) => b.specificChain === "svm" && b.tokenSymbol === "sol",
      );
      expect(svmSolBalance?.amount).toBe(100);

      const baseUsdcBalance = storedBalances.find(
        (b) => b.specificChain === "base" && b.tokenSymbol === "usdc",
      );
      expect(baseUsdcBalance?.amount).toBe(25000);
    });

    test("should initialize agents with custom balances when competition starts", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Custom Balance Agent",
        });

      const customBalances: InitialBalance[] = [
        {
          specificChain: "svm" as SpecificChain,
          tokenSymbol: "usdc",
          amount: 75000, // 75k USDC
        },
        {
          specificChain: "base" as SpecificChain,
          tokenSymbol: "eth",
          amount: 10, // 10 ETH on Base
        },
      ];

      // Start competition with custom balances
      const startResult = await adminClient.startCompetition({
        name: `Custom Init Balance Test ${Date.now()}`,
        agentIds: [agent.id],
        initialBalances: customBalances,
      });

      expect(startResult.success).toBe(true);

      // Check agent's actual balances
      const balanceResponse = await agentClient.getBalance();
      expect(balanceResponse.success).toBe(true);
      const balances = (balanceResponse as BalancesResponse).balances;

      // Find SVM USDC balance
      const svmUsdcBalance = balances.find(
        (b) => b.tokenAddress === config.specificChainTokens.svm.usdc,
      );
      expect(svmUsdcBalance?.amount).toBe(75000);

      // Find Base ETH balance
      const baseEthBalance = balances.find(
        (b) => b.tokenAddress === config.specificChainTokens.base.eth,
      );
      expect(baseEthBalance?.amount).toBe(10);
    });

    test("should use default balances when not specified", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Default Balance Agent",
        });

      // Start competition without custom balances
      const startResult = await adminClient.startCompetition({
        name: `Default Balance Test ${Date.now()}`,
        agentIds: [agent.id],
      });

      expect(startResult.success).toBe(true);

      // Check agent's balances match defaults from config
      const balanceResponse = await agentClient.getBalance();
      expect(balanceResponse.success).toBe(true);
      const balances = (balanceResponse as BalancesResponse).balances;

      // Verify default balances from config.specificChainBalances
      for (const [chain, tokens] of Object.entries(
        config.specificChainBalances,
      )) {
        for (const [symbol, amount] of Object.entries(tokens)) {
          if (amount > 0) {
            // Find corresponding token address
            const chainTokens =
              config.specificChainTokens[
              chain as keyof typeof config.specificChainTokens
              ];
            if (chainTokens && symbol in chainTokens) {
              const tokenAddress =
                chainTokens[symbol as keyof typeof chainTokens];
              const balance = balances.find(
                (b) => b.tokenAddress === tokenAddress,
              );
              expect(balance?.amount).toBe(amount);
            }
          }
        }
      }
    });
  });

  describe("Competition Rules Integration", () => {
    test("should reflect custom configuration in competition rules", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { client: agentClient, agent } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Rules Test Agent",
        });

      const customConfig: CompetitionConfiguration = {
        maxTradePercentage: 20,
      };

      const customBalances: InitialBalance[] = [
        {
          specificChain: "svm" as SpecificChain,
          tokenSymbol: "usdc",
          amount: 100000,
        },
      ];

      // Start competition
      const startResult = await adminClient.startCompetition({
        name: `Rules Config Test ${Date.now()}`,
        agentIds: [agent.id],
        competitionConfiguration: customConfig,
        initialBalances: customBalances,
      });

      expect(startResult.success).toBe(true);
      const competition = (startResult as StartCompetitionResponse).competition;

      // Get competition rules via agent
      const rulesResponse = await agentClient.getCompetitionRules(
        competition.id,
      );
      expect(rulesResponse.success).toBe(true);

      const rules = (rulesResponse as CompetitionRulesResponse).rules;

      // Check that rules reflect custom configuration
      expect(rules.tradingRules).toContain(
        "Maximum single trade: 20% of agent's total portfolio value",
      );

      // Check initial balances in rules
      expect(
        rules.tradingRules.find((r) => r.includes("100000 USDC")),
      ).toBeDefined();
    });

    test("should get competition-specific rules via competition ID", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const customConfig: CompetitionConfiguration = {
        maxTradePercentage: 5, // Very restrictive
      };

      // Create competition with custom config
      const createResult = await adminClient.createCompetition(
        `Specific Rules Test ${Date.now()}`,
        "Test specific competition rules",
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // type
        undefined, // endDate
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // joinStartDate
        undefined, // joinEndDate
        undefined, // maxParticipants
        undefined, // tradingConstraints
        undefined, // rewards
        customConfig,
      );

      expect(createResult.success).toBe(true);
      const competition = (createResult as CreateCompetitionResponse)
        .competition;

      // Get competition-specific rules
      const rulesResponse = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${competition.id}/rules`,
      );

      if ("error" in rulesResponse) {
        throw new Error(
          `Failed to get competition rules: ${rulesResponse.error}`,
        );
      }
      expect(rulesResponse.success).toBe(true);
      const rules = rulesResponse.rules;

      // Verify custom max trade percentage
      expect(rules.tradingRules).toContain(
        "Maximum single trade: 5% of agent's total portfolio value",
      );
    });
  });

  describe("Dynamic Portfolio Snapshot Scheduling", () => {
    test("should update snapshot schedule based on active competition configuration", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Snapshot Schedule Agent",
      });

      // Start competition with custom configuration
      const customConfig: CompetitionConfiguration = {
        maxTradePercentage: 20,
      };

      const startResult = await adminClient.startCompetition({
        name: `Snapshot Schedule Test ${Date.now()}`,
        agentIds: [agent.id],
        competitionConfiguration: customConfig,
      });

      expect(startResult.success).toBe(true);
      const competition = (startResult as StartCompetitionResponse).competition;

      // Wait for configuration to be loaded
      await wait(1000);

      // Verify the configuration was stored correctly
      const [storedConfig] = await db
        .select()
        .from(competitionConfigurations)
        .where(eq(competitionConfigurations.competitionId, competition.id));

      expect(storedConfig).toBeDefined();
      expect(storedConfig!.maxTradePercentage).toBe(20);
    });
  });

  describe("Competition Switching Behavior", () => {
    test("should reflect correct configuration when switching active competitions", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent for both competitions
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Switching Test Agent",
      });

      // Start first competition with config
      const startResult1 = await adminClient.startCompetition(
        "Competition 1",
        "First competition with 10% max trade",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        {
          maxTradePercentage: 10,
        }, // competitionConfiguration
      );
      expect(startResult1.success).toBe(true);
      const comp1 = (startResult1 as StartCompetitionResponse).competition;

      // Verify rules reflect first competition's config
      const rules1 = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${comp1.id}/rules`,
      );
      if ("error" in rules1) {
        throw new Error(`Failed to get rules: ${rules1.error}`);
      }

      expect(rules1.rules.tradingRules).toContain(
        "Maximum single trade: 10% of agent's total portfolio value",
      );

      // End first competition
      await adminClient.endCompetition(comp1.id);

      // Start second competition with different config
      const startResult2 = await adminClient.startCompetition(
        "Competition 2",
        "Second competition with 20% max trade",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        {
          maxTradePercentage: 20,
        }, // competitionConfiguration
      );
      expect(startResult2.success).toBe(true);
      const comp2 = (startResult2 as StartCompetitionResponse).competition;

      // Verify rules reflect second competition's config
      const rules2 = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${comp2.id}/rules`,
      );
      if ("error" in rules2) {
        throw new Error(`Failed to get rules: ${rules2.error}`);
      }
      expect(rules2.rules.tradingRules).toContain(
        "Maximum single trade: 20% of agent's total portfolio value",
      );
    });

    test("should fallback to environment config when no competition config exists", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent first
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "No Config Agent",
      });

      // Start competition without configuration
      const startResult = await startTestCompetition(
        adminClient,
        "No Config Competition",
        [agent.id],
      );
      const competition = startResult.competition;

      // Get rules - should show env defaults
      const rulesResponse = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${competition.id}/rules`,
      );

      if ("error" in rulesResponse) {
        throw new Error(`Failed to get rules: ${rulesResponse.error}`);
      }

      // Verify defaults are used (default is 15% from .env.test)
      expect(rulesResponse.rules.tradingRules).toContain(
        `Maximum single trade: 15% of agent's total portfolio value`,
      );
    });
  });

  describe("Error Scenarios and Edge Cases", () => {
    test("should handle edge case percentage values", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Edge Case Agent",
      });

      // Test with 0% max trade
      const startResult1 = await adminClient.startCompetition(
        "Zero Percent Competition",
        "Competition with 0% max trade",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        {
          maxTradePercentage: 0,
        }, // competitionConfiguration
      );

      // 0% trade might be rejected
      if (!startResult1.success) {
        expect("error" in startResult1 && startResult1.error).toBeTruthy();
        // If 0% is invalid, test with a very small percentage instead
        const smallResult = await adminClient.startCompetition(
          "Small Percent Competition",
          "Competition with 1% max trade",
          [agent.id],
          undefined, // tradingType
          undefined, // sandboxMode
          undefined, // externalUrl
          undefined, // imageUrl
          undefined, // votingStartDate
          undefined, // votingEndDate
          undefined, // tradingConstraints
          {
            maxTradePercentage: 1,
          }, // competitionConfiguration
        );
        expect(smallResult.success).toBe(true);
        const smallComp = (smallResult as StartCompetitionResponse).competition;
        await adminClient.endCompetition(smallComp.id);
      } else {
        const comp1 = (startResult1 as StartCompetitionResponse).competition;
        // Verify in rules
        const rules1 = await adminClient.request<CompetitionRulesResponse>(
          "get",
          `/api/competitions/${comp1.id}/rules`,
        );
        if ("error" in rules1) {
          throw new Error(`Failed to get rules: ${rules1.error}`);
        }
        expect(rules1.rules.tradingRules).toContain(
          "Maximum single trade: 0% of agent's total portfolio value",
        );
        await adminClient.endCompetition(comp1.id);
      }

      // Small delay to ensure cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Test with 100% max trade - this should work
      const startResult2 = await adminClient.startCompetition(
        "Full Portfolio Competition",
        "Competition with 100% max trade",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        {
          maxTradePercentage: 100,
        }, // competitionConfiguration
        undefined, // initialBalances - will use defaults
      );

      expect(startResult2.success).toBe(true);
      const comp2 = (startResult2 as StartCompetitionResponse).competition;

      // Verify in rules
      const rules2 = await adminClient.request<CompetitionRulesResponse>(
        "get",
        `/api/competitions/${comp2.id}/rules`,
      );
      if ("error" in rules2) {
        throw new Error(`Failed to get rules: ${rules2.error}`);
      }
      expect(rules2.rules.tradingRules).toContain(
        "Maximum single trade: 100% of agent's total portfolio value",
      );
    });

    test("should handle negative initial balance amounts", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      // Register agent that will be in the competition
      const { agent } = await registerUserAndAgentAndGetClient({
        adminApiKey,
        agentName: "Negative Balance Agent",
      });

      // Try to start competition with negative balance
      const result = await adminClient.startCompetition(
        "Negative Balance Competition",
        "Testing negative initial balance",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        undefined, // competitionConfiguration
        [
          {
            specificChain: SpecificChain.SVM,
            tokenSymbol: "sol",
            amount: -100,
          },
        ], // initialBalances
      );

      // The API should reject negative balances at schema validation
      expect(result.success).toBe(false);
      if ("error" in result) {
        // Zod validation message for min(0) violation
        expect(result.error.toLowerCase()).toMatch(
          /too small|minimum|must be.*0|greater than or equal/i,
        );
      }
    });

    test("should handle empty initial balances array", async () => {
      const adminClient = createTestClient();
      await adminClient.loginAsAdmin(adminApiKey);

      const { agent, client: agentClient } =
        await registerUserAndAgentAndGetClient({
          adminApiKey,
          agentName: "Empty Balance Agent",
        });

      const result = await adminClient.startCompetition(
        "Empty Balances Competition",
        "Testing empty initial balances",
        [agent.id],
        undefined, // tradingType
        undefined, // sandboxMode
        undefined, // externalUrl
        undefined, // imageUrl
        undefined, // votingStartDate
        undefined, // votingEndDate
        undefined, // tradingConstraints
        undefined, // competitionConfiguration
        [], // initialBalances - Empty array
      );

      expect(result.success).toBe(true);

      // Check balances through API - agent is already in competition
      const balancesResponse = await agentClient.getBalance();
      if ("error" in balancesResponse) {
        throw new Error(`Failed to get balances: ${balancesResponse.error}`);
      }
      const balances = (balancesResponse as BalancesResponse).balances;

      // With empty initial balances config, agent should get default balances
      expect(balances.length).toBeGreaterThan(0);
    });
  });
});
