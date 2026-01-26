import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { cookies, headers } from "next/headers";

import { createLogger } from "@/lib/logger";
import { privyClient } from "@/lib/privy-client";
import { competitionRepository } from "@/lib/repositories";
import {
  adminService,
  agentService,
  arenaService,
  balanceService,
  boostBonusService,
  competitionService,
  partnerService,
  portfolioSnapshotterService,
  rewardsService,
  userService,
} from "@/lib/services";
import { router } from "@/rpc/router/admin/index";

const openApiHandler = new OpenAPIHandler(router, {
  plugins: [
    new OpenAPIReferencePlugin({
      docsProvider: "swagger",
      schemaConverters: [new ZodToJsonSchemaConverter()],
      specGenerateOptions: {
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
curl -X GET "https://api.example.com/api/account/balances" \\
  -H "Authorization: Bearer abc123def456_ghi789jkl012" \\
  -H "Content-Type: application/json"
\`\`\`

**JavaScript Example:**

\`\`\`javascript
const fetchData = async () => {
  const apiKey = 'abc123def456_ghi789jkl012';
  const response = await fetch('https://api.example.com/api/account/balances', {
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
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: "privy-id-token",
              description: "Privy authentication token stored in cookie",
            },
          },
        },
        security: [
          {
            BearerAuth: [],
          },
          {
            AgentApiKey: [],
          },
          {
            cookieAuth: [],
          },
        ],
      },
    }),
  ],
});

async function handleRequest(
  request: Request,
  { params }: { params: Promise<Record<string, string | string[]>> },
) {
  const { matched, response } = await openApiHandler.handle(request, {
    prefix: "/api",
    context: {
      cookies: await cookies(),
      headers: await headers(),
      params: await params,
      privyClient,
      adminService,
      boostBonusService,
      userService,
      competitionService,
      competitionRepository,
      agentService,
      arenaService,
      partnerService,
      balanceService,
      portfolioSnapshotterService,
      rewardsService,
      logger: createLogger("OpenApiHandler"),
    },
  });

  if (matched) {
    return response;
  }

  return new Response("Not found", { status: 404 });
}

export const HEAD = handleRequest;
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
