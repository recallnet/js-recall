// Subnet IDs
export const TESTNET_SUBNET_ID =
  "/r314159/t410fxhurcl3in7vbb3l245noc3nace7il74t45js7sa";
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
  "https://object-api.node-0.testnet.recall.network";
export const LOCALNET_OBJECT_API_URL = "http://127.0.0.1:8001";
export const DEVNET_OBJECT_API_URL = "http://127.0.0.1:8001";

// Miscellaneous
export const RPC_TIMEOUT = 60_000;
export const MIN_TTL = 3600n; // one hour
export const MAX_OBJECT_SIZE = 5_000_000_000; // 5GB
