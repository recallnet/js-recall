# @recallnet/network-constants

This package provides constants for various Recall Network environments including Testnet, Localnet, and Devnet. These constants include chain IDs, RPC URLs, contract addresses, and other configuration values.

## Installation

```bash
pnpm add @recallnet/network-constants
```

## Usage

```typescript
import {
  TESTNET_CHAIN_ID,
  TESTNET_EVM_RPC_URL,
  // other constants...
} from "@recallnet/network-constants";

console.log(`Testnet Chain ID: ${TESTNET_CHAIN_ID}`);
```

## Constants

The package provides constants for:

- Subnet IDs
- Chain IDs
- CometBFT RPC URLs
- EVM RPC URLs
- Object API URLs
- Registrar URLs
- Explorer URLs
- Faucet URLs
- Miscellaneous configuration values
- Contract addresses for various services

## License

MIT AND Apache-2.0
