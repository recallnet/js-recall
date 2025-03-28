# @recallnet/chains

This package provides chain configurations and utility functions for interacting with Recall Network chains. It includes definitions for Testnet, Localnet, and Devnet environments with their respective chain configurations.

## Installation

```bash
pnpm add @recallnet/chains
```

## Usage

```typescript
import { devnet, getChain, localnet, testnet } from "@recallnet/chains";
// Check if a chain has a parent chain
import { checkHasParentChain, getParentChain } from "@recallnet/chains";
// Get service URLs for a chain
import { getExplorerUrl, getObjectApiUrl } from "@recallnet/chains";

// Get a specific chain by name
const chain = getChain("testnet");

const hasParent = checkHasParentChain(testnet);
const parentChain = getParentChain(testnet);

const apiUrl = getObjectApiUrl(testnet);
const explorerUrl = getExplorerUrl(testnet);
```

## Features

- Chain configurations for Testnet, Localnet, and Devnet
- Utility functions for checking chain support
- Utility functions for retrieving parent chains
- Utility functions for retrieving service URLs

## License

MIT AND Apache-2.0
