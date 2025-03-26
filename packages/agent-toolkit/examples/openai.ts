import { config } from "dotenv";
import { existsSync } from "fs";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

import { RecallAgentToolkit } from "../src/openai/index.js";

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

const openai = new OpenAI({
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
      network: RECALL_NETWORK!,
    },
  },
});

(async (): Promise<void> => {
  let messages: ChatCompletionMessageParam[] = [
    {
      role: "user",
      content: `Create a bucket called 'agent-toolkit-test' and tell me its resulting bucket address, and
      then get the account info for the account that created it.`,
    },
  ];

  while (true) {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools: recallAgentToolkit.getTools(),
    });

    if (!completion.choices[0]?.message) {
      throw new Error("No message returned from OpenAI");
    }

    const message = completion.choices[0].message;

    messages.push(message);

    if (message.tool_calls) {
      const toolMessages = await Promise.all(
        message.tool_calls.map((tc: any) =>
          recallAgentToolkit.handleToolCall(tc),
        ),
      );
      messages = [...messages, ...toolMessages];
    } else {
      console.log(completion.choices[0].message);
      break;
    }
  }
})();
