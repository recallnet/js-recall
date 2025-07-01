#!/usr/bin/env tsx

import Ajv from "ajv";
import addFormats from "ajv-formats";
import { swaggerSpec } from "../src/config/swagger.js";

/**
 * OpenAPI Schema Validation Script
 * 
 * This script validates that the OpenAPI schemas match the actual data structures
 * returned by the API endpoints. It helps ensure consistency between documentation
 * and implementation.
 */

// Initialize AJV with OpenAPI 3.0 support
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Allow additional properties not in schema
});
addFormats(ajv);

// Type assertion for the swagger spec
const spec = swaggerSpec as {
  components?: {
    schemas?: Record<string, any>;
  };
};

// Add OpenAPI schemas to AJV
const schemas = spec.components?.schemas || {};
for (const [name, schema] of Object.entries(schemas)) {
  try {
    ajv.addSchema(schema, `#/components/schemas/${name}`);
  } catch (error) {
    console.warn(`Failed to add schema ${name}:`, error);
  }
}

/**
 * Validate a response against an OpenAPI schema
 */
function validateResponse(data: any, schemaRef: string): { valid: boolean; errors?: any[] } {
  try {
    const validate = ajv.compile({ $ref: schemaRef });
    const valid = validate(data);
    return {
      valid,
      errors: validate.errors || undefined,
    };
  } catch (error) {
    console.error(`Failed to compile schema ${schemaRef}:`, error);
    return { valid: false, errors: [{ message: `Schema compilation failed: ${error}` }] };
  }
}

/**
 * Test data that represents actual API responses
 */
const testCases = [
  {
    name: "AgentPublic Schema",
    schema: "#/components/schemas/AgentPublic",
    data: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      ownerId: "123e4567-e89b-12d3-a456-426614174001",
      name: "Test Agent",
      description: "A test trading agent",
      imageUrl: "https://example.com/image.jpg",
      email: "agent@example.com",
      walletAddress: "0x1234567890abcdef1234567890abcdef12345678",
      isVerified: true,
      metadata: {
        skills: ["trading", "analysis"],
        trophies: ["first_trade"],
        hasUnclaimedRewards: false,
      },
      status: "active",
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
  },
  {
    name: "Trade Schema",
    schema: "#/components/schemas/Trade",
    data: {
      id: "123e4567-e89b-12d3-a456-426614174002",
      agentId: "123e4567-e89b-12d3-a456-426614174000",
      competitionId: "123e4567-e89b-12d3-a456-426614174003",
      fromToken: "So11111111111111111111111111111111111111112",
      toToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      fromAmount: 1.5,
      toAmount: 150.0,
      price: 100.0,
      tradeAmountUsd: 150.0,
      toTokenSymbol: "USDC",
      fromTokenSymbol: "SOL",
      success: true,
      error: null,
      reason: "Market analysis indicates favorable conditions",
      timestamp: "2024-01-01T12:00:00Z",
      fromChain: "svm",
      toChain: "svm",
      fromSpecificChain: "svm",
      toSpecificChain: "svm",
    },
  },
  {
    name: "Balance Schema",
    schema: "#/components/schemas/Balance",
    data: {
      tokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: 1000.5,
      symbol: "USDC",
      chain: "svm",
      specificChain: "svm",
    },
  },
  {
    name: "Portfolio Schema",
    schema: "#/components/schemas/Portfolio",
    data: {
      success: true,
      agentId: "123e4567-e89b-12d3-a456-426614174000",
      totalValue: 1500.75,
      tokens: [
        {
          token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amount: 1000.5,
          price: 1.0,
          value: 1000.5,
          chain: "svm",
          specificChain: "svm",
          symbol: "USDC",
        },
        {
          token: "So11111111111111111111111111111111111111112",
          amount: 5.0,
          price: 100.05,
          value: 500.25,
          chain: "svm",
          specificChain: "svm",
          symbol: "SOL",
        },
      ],
      source: "snapshot",
      snapshotTime: "2024-01-01T12:00:00Z",
    },
  },
  {
    name: "Portfolio Schema (Live Calculation)",
    schema: "#/components/schemas/Portfolio",
    data: {
      success: true,
      agentId: "123e4567-e89b-12d3-a456-426614174000",
      totalValue: 1500.75,
      tokens: [
        {
          token: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
          amount: 1000.5,
          price: 1.0,
          value: 1000.5,
          chain: "svm",
          specificChain: "svm",
          symbol: "USDC",
        },
      ],
      source: "live-calculation",
      // No snapshotTime for live calculation
    },
  },
  {
    name: "AgentStats Schema",
    schema: "#/components/schemas/AgentStats",
    data: {
      completedCompetitions: 3,
      totalTrades: 150,
      totalVotes: 42,
      bestPlacement: {
        competitionId: "123e4567-e89b-12d3-a456-426614174003",
        rank: 2,
        score: 95.5,
        totalAgents: 10,
      },
      rank: 5,
      score: 87.3,
    },
  },
  {
    name: "Error Schema",
    schema: "#/components/schemas/Error",
    data: {
      error: "Agent not found",
      status: 404,
      timestamp: "2024-01-01T12:00:00Z",
    },
  },
];

/**
 * Run validation tests
 */
function runValidation() {
  console.log("🔍 Running OpenAPI Schema Validation Tests\n");
  console.log(`📋 Total schemas in spec: ${Object.keys(schemas).length}`);
  console.log(`🧪 Test cases to validate: ${testCases.length}\n`);

  let passedTests = 0;
  let failedTests = 0;

  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Schema: ${testCase.schema}`);
    
    const result = validateResponse(testCase.data, testCase.schema);
    
    if (result.valid) {
      console.log("✅ PASS\n");
      passedTests++;
    } else {
      console.log("❌ FAIL");
      console.log("Validation errors:");
      if (result.errors) {
        result.errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error.instancePath || 'root'}: ${error.message}`);
          if (error.params) {
            console.log(`     Params: ${JSON.stringify(error.params)}`);
          }
        });
      }
      console.log(`Data: ${JSON.stringify(testCase.data, null, 2)}\n`);
      failedTests++;
    }
  }

  console.log("📊 Validation Summary:");
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📈 Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);

  if (failedTests > 0) {
    console.log("\n⚠️  Some schemas failed validation. Please review and fix the issues above.");
    process.exit(1);
  } else {
    console.log("\n🎉 All schemas passed validation!");
  }
}

/**
 * Analyze schema coverage
 */
function analyzeSchemas() {
  console.log("\n📈 Schema Analysis:");
  console.log("Available schemas:");
  
  const schemaNames = Object.keys(schemas).sort();
  const testedSchemas = new Set(testCases.map(tc => tc.schema.split('/').pop()));
  
  schemaNames.forEach(name => {
    const tested = testedSchemas.has(name);
    const icon = tested ? "✅" : "⚠️ ";
    console.log(`  ${icon} ${name}${tested ? "" : " (not tested)"}`);
  });
  
  const coverage = (testedSchemas.size / schemaNames.length) * 100;
  console.log(`\n📊 Test Coverage: ${coverage.toFixed(1)}% (${testedSchemas.size}/${schemaNames.length} schemas tested)`);
}

// Run the validation
try {
  runValidation();
  analyzeSchemas();
} catch (error) {
  console.error("💥 Validation script failed:", error);
  process.exit(1);
}