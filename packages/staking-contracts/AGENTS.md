# AGENTS.md - Staking Contracts Package

This file provides AI agent guidance specific to the staking contracts package.
See root [AGENTS.md](../../AGENTS.md) for repo-wide patterns.

## Purpose

TypeScript interfaces and utilities for staking contract interactions.

## Structure

```
src/
├── abi.ts                      # Contract ABI definitions
├── rewards-claimer.ts          # Claim rewards from contract
├── rewards-allocator.ts        # Allocate rewards
├── safe-transaction-proposer.ts # Gnosis Safe integration
├── externally-owned-account.ts # EOA utilities
├── network.ts                  # Network configuration
├── time-travel.ts              # Test time manipulation
└── index.ts                    # Main exports
```

## Key Patterns

- **Viem**: Uses viem for contract interactions
- **Safe Protocol Kit**: Gnosis Safe SDK integration
- **Merkle proofs**: For rewards claiming
- **Hardhat**: Contract compilation for tests

## Development Commands

```bash
pnpm build            # Build package
pnpm test             # Run tests (compiles contracts first)
pnpm test:integration # Run integration tests
```

## Key File Locations

- ABI: `src/abi.ts`
- Rewards: `src/rewards-claimer.ts`, `src/rewards-allocator.ts`
- Safe: `src/safe-transaction-proposer.ts`
- Network: `src/network.ts`

## Dependencies

- `viem` - Contract interactions
- `@safe-global/protocol-kit` - Safe SDK
- `hardhat` - Contract compilation (dev)
