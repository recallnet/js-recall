# @recallnet/staking-contracts

> Staking contract interfaces and utilities.

## Overview

This package provides TypeScript interfaces for interacting with staking contracts:

- **Contract ABIs** - Staking contract ABI definitions
- **Transaction utilities** - Safe transaction proposing
- **Rewards claiming** - Claim reward functionality
- **Network configuration** - Chain-specific settings

## Installation

```bash
pnpm add @recallnet/staking-contracts
```

## Usage

```typescript
import {
  RewardsAllocator,
  RewardsClaimer,
  STAKING_ABI,
} from "@recallnet/staking-contracts";

// Claim rewards
const claimer = new RewardsClaimer(client, contractAddress);
await claimer.claimRewards(proof);

// Propose Safe transaction
const proposer = new SafeTransactionProposer(safeClient);
await proposer.proposeTransaction(tx);
```

## Features

### Rewards Claiming

Claim staking rewards with Merkle proofs.

### Safe Integration

Propose transactions to Gnosis Safe multisig.

### Time Travel (Testing)

Utilities for manipulating blockchain time in tests.

## Development

```bash
pnpm build            # Build package
pnpm test             # Run tests (requires Hardhat compile)
pnpm test:integration # Run integration tests
```

## License

ISC
