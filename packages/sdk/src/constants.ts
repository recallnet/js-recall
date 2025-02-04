// Subnet IDs
export const TESTNET_SUBNET_ID =
  "/r314159/t410fl5qbhrkyp6jpi2sdh2tryqtssvoe2yrxyl5arzy";
export const LOCALNET_SUBNET_ID =
  "/r31337/t410f6gbdxrbehnaeeo4mrq7wc5hgq6smnefys4qanwi";
export const DEVNET_SUBNET_ID = "test";

// Chain IDs
export const TESTNET_CHAIN_ID = 2481632;
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

// EVM Gateway, Registry, and Supply Source addresses
export const TESTNET_EVM_GATEWAY_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";
export const TESTNET_EVM_REGISTRY_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const TESTNET_EVM_SUPPLY_SOURCE_ADDRESS =
  "0x63DEDA399100Dc536CD4d98FC564ea4Eaf88479F";
export const TESTNET_PARENT_EVM_GATEWAY_ADDRESS =
  "0xb4C4590A2E5Da56aA8310bFF343AFc0645121205";
export const TESTNET_PARENT_EVM_REGISTRY_ADDRESS =
  "0x87CeEfF99935393BdC28c22163344a9498FC44A0";
export const LOCALNET_EVM_GATEWAY_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";
export const LOCALNET_EVM_REGISTRY_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS =
  "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";
export const LOCALNET_PARENT_EVM_GATEWAY_ADDRESS =
  "0x9A676e781A523b5d0C0e43731313A708CB607508";
export const LOCALNET_PARENT_EVM_REGISTRY_ADDRESS =
  "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1";
export const DEVNET_EVM_GATEWAY_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";
export const DEVNET_EVM_REGISTRY_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";

// Wrapper contract addresses, and addresses above formatted in the same way
// TODO: emulates `@wagmi/cli` generated constants
export const blobManagerAddress = {
  2481632: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C", // testnet -- TODO: update this upon new testnet deployments
  248163216: "0xe1Aa25618fA0c7A1CFDab5d6B456af611873b629", // localnet
} as const;

export const bucketManagerAddress = {
  2481632: "0x5aA5cb07469Cabe65c12137400FBC3b0aE265999", // testnet -- TODO: update this upon new testnet deployments
  248163216: "0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D", // localnet
} as const;

export const creditManagerAddress = {
  2481632: "0x3537C0437792B326fa0747b4A95a8667873e916F", // testnet -- TODO: update this upon new testnet deployments
  248163216: "0x82C6D3ed4cD33d8EC1E51d0B5Cc1d822Eaa0c3dC", // localnet
} as const;

export const gatewayManagerFacetAddress = {
  314159: TESTNET_PARENT_EVM_GATEWAY_ADDRESS, // calibration
  2481632: TESTNET_EVM_GATEWAY_ADDRESS, // testnet
  31337: LOCALNET_PARENT_EVM_GATEWAY_ADDRESS, // anvil
  248163216: LOCALNET_EVM_GATEWAY_ADDRESS, // localnet
  1942764459484029: DEVNET_EVM_GATEWAY_ADDRESS, // devnet
} as const;

export const supplySourceAddress = {
  314159: TESTNET_EVM_SUPPLY_SOURCE_ADDRESS, // calibration (for testnet)
  31337: LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS, // anvil (for localnet)
} as const;

// Miscellaneous
export const RPC_TIMEOUT = 60_000;
export const MIN_TTL = 3600n; // one hour
export const MAX_OBJECT_LENGTH = 5_000_000_000; // 5GB
