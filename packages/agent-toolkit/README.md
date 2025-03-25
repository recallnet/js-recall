# Recall Agent Toolkit

> A collection of framework-agnostic agent tools for building Recall agents.

## Table of Contents

- [Background](#background)
- [Usage](#usage)
  - [Installation](#installation)
  - [Adapters](#adapters)
  - [Resources \& permissions](#resources--permissions)
  - [Shared components](#shared-components)
    - [Tools \& prompts](#tools--prompts)
  - [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## Background

The `@recallnet/agent-toolkit` is a collection of tools for building agents that interact with Recall. It is **_heavily_** inspired by the [Stripe Agent Toolkit](https://github.com/stripe/agent-toolkit) project and makes it easy to use a unified API across different frameworks. There are framework agnostic adapters for:

| Framework                                                               | Package import path                  |
| ----------------------------------------------------------------------- | ------------------------------------ |
| [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) | `@recallnet/agent-toolkit/mcp`       |
| [LangChain](https://github.com/langchain-ai/langchainjs)                | `@recallnet/agent-toolkit/langchain` |
| [OpenAI](https://github.com/openai/openai-node)                         | `@recallnet/agent-toolkit/openai`    |
| [AI SDK](https://github.com/vercel/ai)                                  | `@recallnet/agent-toolkit/ai-sdk`    |

## Usage

### Installation

Install the package with your preferred package manager, such as pnpm, npm, yarn, or deno:

```bash
pnpm add @recallnet/agent-toolkit
```

With npm:

```bash
npm install @recallnet/agent-toolkit
```

With yarn:

```bash
yarn add @recallnet/agent-toolkit
```

Or with deno:

```ts
deno add npm:@recallnet/agent-toolkit
```

### Adapters

You can import the appropriate tool with the same `RecallAgentToolkit` class, regardless of the framework you're using. The only difference is the import path—for example:

```ts
// MCP
import { RecallAgentToolkit } from "@recallnet/agent-toolkit/mcp";
// LangChain
import { RecallAgentToolkit } from "@recallnet/agent-toolkit/langchain";
// OpenAI
import { RecallAgentToolkit } from "@recallnet/agent-toolkit/openai";
// AI SDK
import { RecallAgentToolkit } from "@recallnet/agent-toolkit/ai-sdk";
```

The general usage is the same for all adapters where you initialize the `RecallAgentToolkit` with your private key (hex string) and configuration (i.e., desired resources and permissions).

```ts
const toolkit = new RecallAgentToolkit({
  privateKey: "0x...",
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
      network: "testnet",
    },
  },
});
```

### Resources & permissions

The `@recallnet/agent-toolkit` package provides a set of tools that can be used to interact with Recall. Each tool has a set of resources and permissions that are used to determine what actions can be performed. It allows you to refine which tools are available by specifying the resources and permissions for each tool.

The resources are:

- `account`: Account operations, like reading balances or buying credit
- `bucket`: Bucket operations, like creating buckets or adding objects

The permissions are:

- `read`: Read-only operations (i.e., operations that do not cost any tokens/credit)
- `write`: Write operations, which modify state (i.e., operations that submit transactions)

For example, the `get_account_info` tool has the following resources and permissions:

- Resource: `account`
- Permission: `read`

Whereas the `create_bucket` tool has the following resources and permissions:

- Resource: `bucket`
- Permission: `write`

Upon instantiating the `RecallAgentToolkit`, you can define the resources and permissions you want to be available to the agent.

```ts
import { Configuration } from "@recallnet/agent-toolkit/shared";

const config: Configuration = {
  actions: {
    account: {
      read: true,
      write: false, // E.g., if you want to disable buying tokens or credits, set this to `false`
    },
    bucket: {
      read: true,
      write: true,
    },
  },
  context: {
    network: "testnet", // Optional "testnet" or "localnet"
  },
};
```

### Shared components

Under the hood, the `RecallAgentToolkit` uses the `RecallAPI` to interact with Recall. If you'd like to use the `RecallAPI` directly, you can import it from the `@recallnet/agent-toolkit/shared` package.

```ts
import { Configuration, RecallAPI } from "@recallnet/agent-toolkit/shared";
```

This is a wrapper around the agent `tools` that call the Recall network through the `@recallnet/sdk` package.

#### Tools & prompts

The `RecallAgentToolkit` exposes the following tools:

| Tool                   | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `get_account_info`     | Get Recall account information (e.g., address, balance)                |
| `get_credit_info`      | Get Recall account credit information (e.g., credit available or used) |
| `buy_credit`           | Buy credit for Recall account                                          |
| `list_buckets`         | List all buckets owned by an address                                   |
| `get_or_create_bucket` | Get or create a bucket in Recall                                       |
| `add_object`           | Add an object to a Recall bucket                                       |
| `get_object`           | Get an object from a Recall bucket                                     |
| `query_objects`        | Query objects in a Recall bucket                                       |

Each of these also has a corresponding prompt that is used to generate the tool call. For example, the `get_account_info` tool has the following prompt:

```ts
import { getAccountInfoPrompt } from "@recallnet/agent-toolkit/shared";

const prompt = getAccountInfoPrompt;
console.log(prompt);
```

Frameworks will, generally, see the prompt alongside the tool call, which gives the agent context on what the tool does and the arguments it accepts:

```txt
This tool will get account information from Recall, including token $RECALL balances, address, and nonce.

Arguments:
- address (str, optional): The address of the account, else, defaults to the connected user's account address.
```

### Examples

A few examples of how to use the `RecallAgentToolkit` are available in the [`/examples`](./examples) directory. There is one for each framework adapter: MCP, LangChain, OpenAI, and AI SDK. To use them, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/recallnet/agent-toolkit
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the project:
   ```bash
   pnpm run build
   ```
4. Change into the `examples` directory and create a `.env` file (based on `.env.example`) with your Recall private key:

   ```bash
   cd examples
   cp .env.example .env
   ```

   ```txt
   # .env
   RECALL_PRIVATE_KEY=your_private_key_here
   RECALL_NETWORK=testnet

   # Required for all but the MCP example
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. Run one of the examples, for example, with `tsx`:
   - OpenAI:
     ```bash
     npx tsx openai.ts
     ```
   - LangChain:
     ```bash
     npx tsx langchain.ts
     ```
   - MCP:
     ```bash
     npx tsx mcp.ts --tools=all
     ```
   - AI SDK:
     ```bash
     npx tsx ai-sdk.ts
     ```

## Development

The following `pnpm` commands are available:

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `pnpm install`      | Install dependencies                            |
| `pnpm build`        | Build the project                               |
| `pnpm dev`          | Run in development mode                         |
| `pnpm lint`         | Lint the project with ESLint                    |
| `pnpm lint:fix`     | Lint the project and fix linting errors         |
| `pnpm format:check` | Check if the project is formatted with Prettier |
| `pnpm format`       | Format the project (writes files)               |

## Contributing

PRs accepted.

Small note: If editing the README, please conform to
the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Network Corporation
