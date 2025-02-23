// Subnet IDs
export const TESTNET_SUBNET_ID =
  "/r314159/t410f6mgygsxksvrptmf43vaopcwmni4tbw7jx3mo4gi";
export const LOCALNET_SUBNET_ID =
  "/r31337/t410f6gbdxrbehnaeeo4mrq7wc5hgq6smnefys4qanwi";
export const DEVNET_SUBNET_ID = "test";

// Chain IDs
export const TESTNET_PARENT_CHAIN_ID = 314159;
export const TESTNET_CHAIN_ID = 2481632;
export const LOCALNET_PARENT_CHAIN_ID = 31337;
export const LOCALNET_CHAIN_ID = 248163216;
export const DEVNET_CHAIN_ID = 1942764459484029;

// CometBFT RPC URLs
export const TESTNET_RPC_URL = "https://api.node-0.testnet.recall.network";
export const LOCALNET_RPC_URL = "http://127.0.0.1:26657";
export const DEVNET_RPC_URL = "http://127.0.0.1:26657";

// EVM RPC URLs
export const TESTNET_EVM_RPC_URL = "https://evm.node-0.testnet.recall.network";
export const TESTNET_EVM_WS_URL = "wss://evm.node-0.testnet.recall.network";
export const TESTNET_PARENT_EVM_RPC_URL =
  "https://api.calibration.node.glif.io/rpc/v1";
export const LOCALNET_EVM_RPC_URL = "http://127.0.0.1:8645";
export const LOCALNET_EVM_WS_URL = "ws://127.0.0.1:8645";
export const LOCALNET_PARENT_EVM_RPC_URL = "http://127.0.0.1:8545";
export const DEVNET_EVM_RPC_URL = "http://127.0.0.1:8545";
export const DEVNET_EVM_WS_URL = "ws://127.0.0.1:8545";

// Objects API URLs
export const TESTNET_OBJECT_API_URL =
  "https://objects.node-0.testnet.recall.network";
export const LOCALNET_OBJECT_API_URL = "http://127.0.0.1:8001";
export const DEVNET_OBJECT_API_URL = "http://127.0.0.1:8001";

// Registrar URLs
export const TESTNET_REGISTRAR_URL =
  "https://faucet.node-0.testnet.recall.network";

// Explorer URLs
export const TESTNET_EXPLORER_URL = "https://explorer.testnet.recall.network";
export const LOCALNET_EXPLORER_URL = "http://127.0.0.1:8000";
export const DEVNET_EXPLORER_URL = "http://127.0.0.1:8000";

// Faucet URLs
export const TESTNET_FAUCET_URL = "https://faucet.recall.network";

// Miscellaneous
export const RPC_TIMEOUT = 60_000;
export const MIN_TTL = 3600n; // one hour
export const MAX_OBJECT_SIZE = 5_000_000_000; // 5GB

// Gateway Manager Facet contract addresses
export const TESTNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x83BaA1161529413e1c61D7b66BD252Bc5c10A6Cd";
export const TESTNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";
export const LOCALNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x9A676e781A523b5d0C0e43731313A708CB607508";
export const LOCALNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";
export const DEVNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";

// Subnet Getter (Registry) Facet contract addresses
export const TESTNET_PARENT_SUBNET_GETTER_FACET_ADDRESS =
  "0x7e974301C8a8aB3502AaB1ed36f155354c84505f";
export const LOCALNET_PARENT_SUBNET_GETTER_FACET_ADDRESS =
  "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44";
export const TESTNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const LOCALNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const DEVNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";

// ERC20 contract addresses
export const TESTNET_PARENT_ERC20_ADDRESS =
  "0xF084d7543d3B1c3beb2a1D26b5Ae554051D797F9";
export const LOCALNET_PARENT_ERC20_ADDRESS =
  "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

// BlobManager contract addresses
export const TESTNET_BLOB_MANAGER_ADDRESS =
  "0x22F1039343b4F5cE3C74872B239524d4fFb7CABF";
export const LOCALNET_BLOB_MANAGER_ADDRESS =
  "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629";

// BucketManager contract addresses
export const TESTNET_BUCKET_MANAGER_ADDRESS =
  "0x8ce218Fc1e9C443a5A7255B6845d35C104b91516";
export const LOCALNET_BUCKET_MANAGER_ADDRESS =
  "0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D";

// CreditManager contract addresses
export const TESTNET_CREDIT_MANAGER_ADDRESS =
  "0xe62FBa17E5B9965434C2871492c7Ac851fA8BAF7";
export const LOCALNET_CREDIT_MANAGER_ADDRESS =
  "0x82C6D3ed4cD33d8EC1E51d0B5Cc1d822Eaa0c3dC";
