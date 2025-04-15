# `js-recall`

[![License](https://img.shields.io/github/license/recallnet/js-recall.svg)](./LICENSE)
[![standard-readme compliant](https://img.shields.io/badge/standard--readme-OK-green.svg)](https://github.com/RichardLitt/standard-readme)

> JS/TS monorepo for Recall

## Table of Contents

- [Background](#background)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Development](#development)
- [Development with Cursor](#development-with-cursor)
- [Contributing](#contributing)
- [License](#license)

## Background

This repository contains packages and applications for Recall, written in JavaScript/TypeScript. It's structured as a monorepo using Turborepo and pnpm workspaces for efficient package management and build orchestration.

## Project Structure

```
js-recall/
├── apps/                    # Application packages
│   ├── portal/             # Main web application
│   └── faucet/            # Faucet application
├── packages/               # Shared packages
│   ├── sdk/               # Core SDK implementation
│   ├── react/              # Extended SDK features
│   ├── ui/                # Shared UI component library
│   ├── contracts/         # Smart contract interfaces
│   ├── chains/            # Chain-specific configurations
│   ├── address-utils/     # Address manipulation utilities
│   ├── conversions/      # BigInt manipulation utilities
│   ├── fvm/               # FVM-specific functionality
│   ├── network-constants/ # Network configuration constants
│   ├── fonts/            # Shared font resources
│   ├── eslint-config/    # Shared ESLint configuration
│   └── typescript-config/ # Shared TypeScript configuration
└── .changeset/           # Changesets for version management
```

## Prerequisites

- Node.js >= 20
- pnpm 9.12.3 or higher
- Git

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/recallnet/js-recall.git
   cd js-recall
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

3. Build all packages:
   ```bash
   pnpm build
   ```

## Usage

Each package in the monorepo has its own specific usage instructions. Here's a quick overview:

### Applications

- **Portal** (`apps/portal`): Main web application

  ```bash
  cd apps/portal
  pnpm dev
  ```

- **Faucet** (`apps/faucet`): Faucet application
  ```bash
  cd apps/faucet
  pnpm dev
  ```

### Core Packages

- **SDK** (`@recallnet/sdk`): Core SDK implementation

  ```typescript
  import { RecallSDK } from "@recallnet/sdk";
  ```

- **UI Library** (`@recallnet/ui`): Shared UI components
  ```typescript
  import { Button } from "@recallnet/ui";
  ```

See individual package READMEs for detailed usage instructions.

## Development

The monorepo uses Turborepo for task orchestration. The following commands are available from root:

### Common Commands

- `pnpm build`: Build all packages
- `pnpm dev`: Run all packages in development mode (concurrency: 20)
- `pnpm lint`: Run all linters
- `pnpm format`: Format all files
- `pnpm clean`: Clean all dependencies

### Version Management

- `pnpm changeset`: Create a new changeset
- `pnpm version-packages`: Update package versions
- `pnpm publish-packages`: Publish to registry

### Development Environment

The project includes configurations for:

- ESLint for code linting
- Prettier for code formatting
- TypeScript for type checking
- Changesets for version management

### IDE Support

The repository includes configurations for:

- VSCode
- Cursor
- Zed

## Development with Cursor

This project is optimized for development using [Cursor](https://cursor.sh/), a modern IDE built for AI-assisted development. The repository includes `.cursorrules` configuration to ensure consistent development experience across the team.

### Agent Mode Configuration

The repository uses Cursor's Agent mode for advanced development assistance:

- `.agent/` directory is git-ignored and used by Cursor Agent for:
  - Task tracking
  - Development plans
  - Contextual information
  - Specifications

### Required Documentation Context

To get the most out of Cursor's AI features, add the following documentation to your Cursor Settings (Settings → Cursor Settings → Features → Docs):

1. Recall TypeScript SDK

   ```
   https://docs.recall.network/tools/sdk/javascript
   ```

2. Recall Rust SDK

   ```
   https://docs.recall.network/tools/sdk/rust
   ```

3. TypeDoc Documentation

   ```
   https://typedoc.org/
   ```

4. Turborepo Documentation
   ```
   https://turbo.build/repo/docs
   ```

### Best Practices

- Use Agent mode when working on complex features or refactoring
- Let the Agent create development plans in `.agent/developer_plan.md`
- For new features, have the Agent create specifications in `.agent/spec.md`
- Reference GitHub issues in Agent-generated specs for traceability
- Review and approve Agent-generated plans before implementation

### Tips

- The Agent can help navigate the monorepo structure
- Use Agent mode for code generation that follows project patterns
- Let the Agent assist with documentation and test creation
- Agent can help ensure compliance with project standards

### Example Agent Prompts

Here are some useful prompts to help you work with the Cursor Agent:

#### Issue Analysis and Spec Creation

```
Use the gh CLI to read and then create a spec for a project to fix this issue: https://github.com/recallnet/js-recall/issues/126
```

#### Code Review and Documentation

```
Review the changes in the current branch and create a PR description that follows our standards. Include a summary of changes, testing notes, and any breaking changes.
```

#### Development Planning

```
Create a development plan for implementing feature X. Break it down into phases and include any necessary research links or documentation references.
```

#### Codebase Navigation

```
Help me understand how the authentication flow works in this codebase. Show me the relevant files and explain the process.
```

#### Testing and Quality

```
Review my changes and suggest appropriate test cases. Include unit tests, integration tests, and edge cases we should consider.
```

## Contributing

PRs accepted. Please ensure your changes follow our coding standards and include appropriate tests.

Small note: If editing the README, please conform to the [standard-readme](https://github.com/RichardLitt/standard-readme) specification.

## License

MIT OR Apache-2.0, © 2025 Recall Contributors
