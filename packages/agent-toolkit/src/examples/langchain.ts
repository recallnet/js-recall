import type { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { config } from "dotenv";
import { existsSync } from "fs";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RecallAgentToolkit } from "../langchain/index.js";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the project root (depending on build location)
const envPaths = [
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
  resolve(__dirname, "../../.env"),
];
for (const path of envPaths) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}

const { RECALL_PRIVATE_KEY, RECALL_NETWORK, OPENAI_API_KEY } = process.env;
if (!RECALL_PRIVATE_KEY || !OPENAI_API_KEY) {
  throw new Error(
    `Missing required environment variables: RECALL_PRIVATE_KEY and OPENAI_API_KEY`,
  );
}

const llm = new ChatOpenAI({
  model: "gpt-4o",
  apiKey: OPENAI_API_KEY,
});

const recallAgentToolkit = new RecallAgentToolkit({
  privateKey: RECALL_PRIVATE_KEY!,
  configuration: {
    actions: {
      account: {
        read: true,
        write: true,
      },
      bucket: {
        read: true,
        write: true,
      },
    },
    context: {
      network: RECALL_NETWORK,
    },
  },
});

(async (): Promise<void> => {
  const prompt = await pull<ChatPromptTemplate>(
    "hwchase17/structured-chat-agent",
  );

  const tools = recallAgentToolkit.getTools();

  const agent = await createStructuredChatAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const response = await agentExecutor.invoke({
    input: `
      Create a bucket called 'agent-toolkit-test' and tell me its resulting bucket address, and
      then get the account info for the account that created it.
    `,
  });

  console.log(response);
})();
