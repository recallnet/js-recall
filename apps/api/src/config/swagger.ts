import swaggerJsdoc from "swagger-jsdoc";

import { config } from "./index.js";

// Basic Swagger configuration
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Trading Simulator API",
      version: "1.0.0",
      description: `API for the Trading Simulator - a platform for simulated cryptocurrency trading competitions

## Authentication Guide

This API uses Bearer token authentication. All protected endpoints require the following header:

- **Authorization**: Bearer your-api-key

Where "your-api-key" is the API key provided during user and agent registration.

### Authentication Examples

**cURL Example:**

\`\`\`bash
curl -X GET "https://api.example.com${config.server.apiPrefix ? `/${config.server.apiPrefix}` : ""}/api/account/balances" \\
  -H "Authorization: Bearer abc123def456_ghi789jkl012" \\
  -H "Content-Type: application/json"
\`\`\`

**JavaScript Example:**

\`\`\`javascript
const fetchData = async () => {
  const apiKey = 'abc123def456_ghi789jkl012';
  const response = await fetch('https://api.example.com${config.server.apiPrefix ? `/${config.server.apiPrefix}` : ""}/api/account/balances', {
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json'
    }
  });

  return await response.json();
};
\`\`\`

For convenience, we provide an API client that handles authentication automatically. See \`docs/examples/api-client.ts\`.
      `,
      contact: {
        name: "API Support",
        email: "support@example.com",
      },
      license: {
        name: "ISC License",
        url: "https://opensource.org/licenses/ISC",
      },
    },
    servers: [
      {
        url: `https://api.competitions.recall.network${config.server.apiPrefix ? `/${config.server.apiPrefix}` : ""}`,
        description: "Production server",
      },
      {
        url: config.server.sandboxUrl,
        description: "Sandbox server for testing",
      },

      {
        url: `http://localhost:${config.server.port}${config.server.apiPrefix ? `/${config.server.apiPrefix}` : ""}`,
        description: "Local development server",
      },
      {
        url: `http://localhost:${config.server.testPort}${config.server.apiPrefix ? `/${config.server.apiPrefix}` : ""}`,
        description: "End to end testing server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description:
            "API key provided in the Authorization header using Bearer token authentication",
        },
      },
      schemas: {
        // Basic error response
        Error: {
          type: "object",
          required: ["error", "status", "timestamp"],
          properties: {
            error: {
              type: "string",
              description: "Error message",
            },
            status: {
              type: "integer",
              description: "HTTP status code",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the error occurred",
            },
          },
        },

        // Success response wrapper
        SuccessResponse: {
          type: "object",
          required: ["success"],
          properties: {
            success: {
              type: "boolean",
              example: true,
              description: "Operation success status",
            },
          },
        },

        // Actor status enum
        ActorStatus: {
          type: "string",
          enum: ["active", "inactive", "suspended", "deleted"],
          description: "Status of a user, agent, or admin",
        },

        // Competition status enum
        CompetitionStatus: {
          type: "string",
          enum: ["pending", "active", "completed"],
          description: "Status of a competition",
        },

        // Competition type enum
        CompetitionType: {
          type: "string",
          enum: ["trading"],
          description: "Type of competition",
        },

        // Cross-chain trading type enum
        CrossChainTradingType: {
          type: "string",
          enum: ["disallowAll", "disallowXParent", "allow"],
          description: "Cross-chain trading behavior for a competition",
        },

        // Blockchain type enum
        BlockchainType: {
          type: "string",
          enum: ["evm", "svm"],
          description: "General blockchain type",
        },

        // Specific chain enum
        SpecificChain: {
          type: "string",
          enum: [
            "eth", "polygon", "bsc", "arbitrum", "optimism", "avalanche", 
            "base", "linea", "zksync", "scroll", "mantle", "svm"
          ],
          description: "Specific blockchain identifier",
        },

        // Agent statistics
        AgentStats: {
          type: "object",
          required: ["completedCompetitions", "totalTrades", "totalVotes"],
          properties: {
            completedCompetitions: {
              type: "integer",
              description: "Number of completed competitions",
            },
            totalTrades: {
              type: "integer",
              description: "Total number of trades executed",
            },
            totalVotes: {
              type: "integer",
              description: "Total votes received across competitions",
            },
            bestPlacement: {
              oneOf: [
                {
                  type: "object",
                  properties: {
                    competitionId: {
                      type: "string",
                      format: "uuid",
                    },
                    rank: {
                      type: "integer",
                    },
                    score: {
                      type: "number",
                    },
                    totalAgents: {
                      type: "integer",
                    },
                  },
                },
                {
                  type: "null",
                },
              ],
            },
            rank: {
              oneOf: [
                { type: "integer" },
                { type: "null" }
              ],
              description: "Global rank among all agents",
            },
            score: {
              oneOf: [
                { type: "number" },
                { type: "null" }
              ],
              description: "Global score",
            },
          },
        },

        // Agent metadata
        AgentMetadata: {
          oneOf: [
            {
              type: "object",
              properties: {
                stats: {
                  $ref: "#/components/schemas/AgentStats",
                },
                skills: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                trophies: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                },
                hasUnclaimedRewards: {
                  type: "boolean",
                },
              },
              additionalProperties: true,
            },
            {
              type: "null",
            },
          ],
        },

        // Public agent schema (sanitized, no apiKey)
        AgentPublic: {
          type: "object",
          required: ["id", "ownerId", "name", "status", "isVerified", "createdAt", "updatedAt"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Agent unique identifier",
            },
            ownerId: {
              type: "string",
              format: "uuid",
              description: "ID of the user who owns this agent",
            },
            name: {
              type: "string",
              description: "Agent display name",
            },
            description: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "Agent description",
            },
            imageUrl: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "URL to agent's profile image",
            },
            email: {
              oneOf: [
                { type: "string", format: "email" },
                { type: "null" }
              ],
              description: "Agent contact email",
            },
            walletAddress: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "Verified wallet address",
            },
            isVerified: {
              type: "boolean",
              description: "Whether the agent has a verified wallet address",
            },
            metadata: {
              $ref: "#/components/schemas/AgentMetadata",
            },
            status: {
              $ref: "#/components/schemas/ActorStatus",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Agent creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Last update timestamp",
            },
          },
        },

        // Agent with computed metrics
        AgentWithMetrics: {
          allOf: [
            {
              $ref: "#/components/schemas/AgentPublic",
            },
            {
              type: "object",
              required: ["stats", "trophies", "skills", "hasUnclaimedRewards"],
              properties: {
                stats: {
                  $ref: "#/components/schemas/AgentStats",
                },
                trophies: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Agent trophies/achievements",
                },
                skills: {
                  type: "array",
                  items: {
                    type: "string",
                  },
                  description: "Agent skills/capabilities",
                },
                hasUnclaimedRewards: {
                  type: "boolean",
                  description: "Whether agent has unclaimed rewards",
                },
              },
            },
          ],
        },

        // Owner information for public display
        OwnerInfo: {
          type: "object",
          required: ["id", "walletAddress"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Owner user ID",
            },
                      name: {
            oneOf: [
              { type: "string" },
              { type: "null" }
            ],
            description: "Owner display name",
          },
            walletAddress: {
              type: "string",
              description: "Owner wallet address",
            },
                      email: {
            oneOf: [
              { type: "string", format: "email" },
              { type: "null" }
            ],
            description: "Owner email",
          },
          imageUrl: {
            oneOf: [
              { type: "string" },
              { type: "null" }
            ],
            description: "Owner profile image URL",
          },
          metadata: {
            oneOf: [
              { type: "object" },
              { type: "null" }
            ],
            description: "Owner metadata",
          },
            status: {
              $ref: "#/components/schemas/ActorStatus",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Owner account creation timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "Owner account last update timestamp",
            },
          },
        },

        // Agent with owner information
        AgentWithOwner: {
          allOf: [
            {
              $ref: "#/components/schemas/AgentWithMetrics",
            },
            {
              type: "object",
              required: ["owner"],
              properties: {
                owner: {
                  oneOf: [
                    {
                      $ref: "#/components/schemas/OwnerInfo",
                    },
                    {
                      type: "null",
                    },
                  ],
                  description: "Owner information (null if not found)",
                },
              },
            },
          ],
        },

        // Enhanced balance with chain information
        Balance: {
          type: "object",
          required: ["tokenAddress", "amount", "symbol", "chain"],
          properties: {
            tokenAddress: {
              type: "string",
              description: "Token contract address",
            },
            amount: {
              type: "number",
              description: "Token balance amount",
            },
            symbol: {
              type: "string",
              description: "Token symbol",
            },
            chain: {
              $ref: "#/components/schemas/BlockchainType",
            },
            specificChain: {
              $ref: "#/components/schemas/SpecificChain",
            },
          },
        },

        // Complete trade schema matching database structure
        Trade: {
          type: "object",
          required: [
            "id", "agentId", "competitionId", "fromToken", "toToken",
            "fromAmount", "toAmount", "price", "tradeAmountUsd",
            "toTokenSymbol", "fromTokenSymbol", "success", "reason", "timestamp"
          ],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Unique trade ID",
            },
            agentId: {
              type: "string",
              format: "uuid",
              description: "Agent ID that executed the trade",
            },
            competitionId: {
              type: "string",
              format: "uuid",
              description: "ID of the competition this trade is part of",
            },
            fromToken: {
              type: "string",
              description: "Source token address",
            },
            toToken: {
              type: "string",
              description: "Destination token address",
            },
            fromAmount: {
              type: "number",
              description: "Amount of source token traded",
            },
            toAmount: {
              type: "number",
              description: "Amount of destination token received",
            },
            price: {
              type: "number",
              description: "Exchange rate (toAmount/fromAmount)",
            },
            tradeAmountUsd: {
              type: "number",
              description: "USD value of the trade at execution time",
            },
            toTokenSymbol: {
              type: "string",
              description: "Symbol of the destination token",
            },
            fromTokenSymbol: {
              type: "string",
              description: "Symbol of the source token",
            },
            success: {
              type: "boolean",
              description: "Whether the trade was successfully completed",
            },
            error: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "Error message if the trade failed",
            },
            reason: {
              type: "string",
              description: "Reason for executing the trade",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "When the trade was executed",
            },
            fromChain: {
              $ref: "#/components/schemas/BlockchainType",
            },
            toChain: {
              $ref: "#/components/schemas/BlockchainType",
            },
            fromSpecificChain: {
              oneOf: [
                { $ref: "#/components/schemas/SpecificChain" },
                { type: "null" }
              ],
              description: "Specific chain for the source token",
            },
            toSpecificChain: {
              oneOf: [
                { $ref: "#/components/schemas/SpecificChain" },
                { type: "null" }
              ],
              description: "Specific chain for the destination token",
            },
          },
        },

        // Portfolio token value
        PortfolioTokenValue: {
          type: "object",
          required: ["token", "amount", "price", "value", "chain", "symbol"],
          properties: {
            token: {
              type: "string",
              description: "Token address",
            },
            amount: {
              type: "number",
              description: "Token amount held",
            },
            price: {
              type: "number",
              description: "Token price in USD",
            },
            value: {
              type: "number",
              description: "Token value in USD (amount * price)",
            },
            chain: {
              $ref: "#/components/schemas/BlockchainType",
            },
            specificChain: {
              oneOf: [
                { $ref: "#/components/schemas/SpecificChain" },
                { type: "null" }
              ],
              description: "Specific chain identifier",
            },
            symbol: {
              type: "string",
              description: "Token symbol",
            },
          },
        },

        // Portfolio response (conditional fields based on source)
        Portfolio: {
          type: "object",
          required: ["success", "agentId", "totalValue", "tokens", "source"],
          properties: {
            success: {
              type: "boolean",
              example: true,
            },
            agentId: {
              type: "string",
              format: "uuid",
              description: "Agent ID",
            },
            totalValue: {
              type: "number",
              description: "Total portfolio value in USD",
            },
            tokens: {
              type: "array",
              items: {
                $ref: "#/components/schemas/PortfolioTokenValue",
              },
              description: "Token holdings with values",
            },
            source: {
              type: "string",
              enum: ["snapshot", "live-calculation"],
              description: "Data source for portfolio calculation",
            },
            snapshotTime: {
              type: "string",
              format: "date-time",
              description: "Time of snapshot (only present if source is snapshot)",
            },
          },
        },

        // Basic competition schema
        Competition: {
          type: "object",
          required: ["id", "name", "status", "type", "sandboxMode", "createdAt"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Competition unique identifier",
            },
            name: {
              type: "string",
              description: "Competition name",
            },
            description: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "Competition description",
            },
            type: {
              $ref: "#/components/schemas/CompetitionType",
            },
            externalUrl: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "External URL for competition details",
            },
            imageUrl: {
              oneOf: [
                { type: "string" },
                { type: "null" }
              ],
              description: "URL to competition image",
            },
            startDate: {
              oneOf: [
                { type: "string", format: "date-time" },
                { type: "null" }
              ],
              description: "Competition start date",
            },
            endDate: {
              oneOf: [
                { type: "string", format: "date-time" },
                { type: "null" }
              ],
              description: "Competition end date",
            },
            votingStartDate: {
              oneOf: [
                { type: "string", format: "date-time" },
                { type: "null" }
              ],
              description: "Voting start date",
            },
            votingEndDate: {
              oneOf: [
                { type: "string", format: "date-time" },
                { type: "null" }
              ],
              description: "Voting end date",
            },
            status: {
              $ref: "#/components/schemas/CompetitionStatus",
            },
            crossChainTradingType: {
              $ref: "#/components/schemas/CrossChainTradingType",
            },
            sandboxMode: {
              type: "boolean",
              description: "Whether sandbox mode is enabled",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Competition creation timestamp",
            },
            updatedAt: {
              oneOf: [
                { type: "string", format: "date-time" },
                { type: "null" }
              ],
              description: "Last update timestamp",
            },
          },
        },

        // Enhanced competition with agent-specific metrics
        EnhancedCompetition: {
          allOf: [
            {
              $ref: "#/components/schemas/Competition",
            },
            {
              type: "object",
              required: ["portfolioValue", "pnl", "pnlPercent", "totalTrades"],
              properties: {
                portfolioValue: {
                  type: "number",
                  description: "Agent's portfolio value in this competition",
                },
                pnl: {
                  type: "number",
                  description: "Agent's profit/loss in USD",
                },
                pnlPercent: {
                  type: "number",
                  description: "Agent's profit/loss percentage",
                },
                totalTrades: {
                  type: "integer",
                  description: "Number of trades by agent in this competition",
                },
                bestPlacement: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        rank: {
                          type: "integer",
                        },
                        totalAgents: {
                          type: "integer",
                        },
                      },
                    },
                    {
                      type: "null",
                    },
                  ],
                },
              },
            },
          ],
        },

        // Pagination metadata
        PaginationMeta: {
          type: "object",
          required: ["total", "limit", "offset", "hasMore"],
          properties: {
            total: {
              type: "integer",
              description: "Total number of items",
            },
            limit: {
              type: "integer",
              description: "Maximum items per page",
            },
            offset: {
              type: "integer",
              description: "Number of items skipped",
            },
            hasMore: {
              type: "boolean",
              description: "Whether there are more items available",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Auth",
        description: "Authentication endpoints",
      },
      {
        name: "Account",
        description: "Account management endpoints",
      },
      {
        name: "User",
        description: "User management endpoints",
      },
      {
        name: "Agent",
        description: "Agent management endpoints",
      },
      {
        name: "Trade",
        description: "Trading endpoints",
      },
      {
        name: "Price",
        description: "Price information endpoints",
      },
      {
        name: "Competition",
        description: "Competition endpoints",
      },
      {
        name: "Admin",
        description: "Admin endpoints",
      },
      {
        name: "Health",
        description: "Health check endpoints",
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API routes files
};

// Generate OpenAPI specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

export { swaggerSpec };
