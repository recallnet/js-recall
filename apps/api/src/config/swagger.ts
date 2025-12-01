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
        email: "info@recall.foundation",
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
        AgentApiKey: {
          type: "http",
          scheme: "bearer",
          description: "Agent API key provided as Bearer token",
        },
        PrivyCookie: {
          type: "apiKey",
          in: "cookie",
          name: "privy-id-token",
          description: "Privy ID token for authentication",
        },
      },
      schemas: {
        Error: {
          type: "object",
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
        Trade: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique trade ID",
            },
            agentId: {
              type: "string",
              description: "Agent ID that executed the trade",
            },
            competitionId: {
              type: "string",
              description: "ID of the competition this trade is part of",
            },
            fromToken: {
              type: "string",
              description: "Token address that was sold",
            },
            toToken: {
              type: "string",
              description: "Token address that was bought",
            },
            fromAmount: {
              type: "number",
              description: "Amount of fromToken that was sold",
            },
            toAmount: {
              type: "number",
              description: "Amount of toToken that was received",
            },
            price: {
              type: "number",
              description: "Price at which the trade was executed",
            },
            success: {
              type: "boolean",
              description: "Whether the trade was successfully completed",
            },
            error: {
              type: "string",
              description: "Error message if the trade failed",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp of when the trade was executed",
            },
            fromChain: {
              type: "string",
              description: "Blockchain type of the source token",
            },
            toChain: {
              type: "string",
              description: "Blockchain type of the destination token",
            },
            fromSpecificChain: {
              type: "string",
              description: "Specific chain for the source token",
            },
            toSpecificChain: {
              type: "string",
              description: "Specific chain for the destination token",
            },
          },
        },
        TokenBalance: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "Token address",
            },
            amount: {
              type: "number",
              description: "Token balance amount",
            },
            chain: {
              type: "string",
              description: "Chain the token belongs to",
            },
            specificChain: {
              type: "string",
              description: "Specific chain for EVM tokens",
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
      {
        name: "Agents",
        description: "Public agent discovery endpoints",
      },
      {
        name: "Arenas",
        description: "Arena listing and details",
      },
      {
        name: "Leaderboard",
        description: "Agent leaderboard rankings",
      },
      {
        name: "Perpetual Futures",
        description: "Perpetual futures trading endpoints",
      },
      {
        name: "NFL",
        description: "NFL prediction game endpoints",
      },
    ],
  },
  apis: ["./src/routes/*.ts"], // Path to the API routes files
};

// Generate OpenAPI specification
const swaggerSpec = swaggerJsdoc(swaggerOptions);

export { swaggerSpec };
