/**
 * Recall Network Constants
 *
 * This module provides constants for various Recall Network environments including Testnet, Localnet, and Devnet.
 * These constants include chain IDs, RPC URLs, contract addresses, and other configuration values.
 *
 * @packageDocumentation
 */

/**
 * Subnet ID for the Recall Testnet.
 */
export const TESTNET_SUBNET_ID =
  "/r314159/t410fntaew3dtef2zpfox2hlhy4cgrksdt5zjwg3hbfi";

/**
 * Subnet ID for the Recall Localnet.
 */
export const LOCALNET_SUBNET_ID =
  "/r31337/t410f6gbdxrbehnaeeo4mrq7wc5hgq6smnefys4qanwi";

/**
 * Subnet ID for the Recall Devnet.
 */
export const DEVNET_SUBNET_ID = "test";

/**
 * Chain ID for the Testnet parent chain (Filecoin Calibration).
 */
export const TESTNET_PARENT_CHAIN_ID = 314159;

/**
 * Chain ID for the Recall Testnet.
 */
export const TESTNET_CHAIN_ID = 2481632;

/**
 * Chain ID for the Localnet parent chain.
 */
export const LOCALNET_PARENT_CHAIN_ID = 31337;

/**
 * Chain ID for the Recall Localnet.
 */
export const LOCALNET_CHAIN_ID = 248163216;

/**
 * Chain ID for the Recall Devnet.
 */
export const DEVNET_CHAIN_ID = 1942764459484029;

/**
 * CometBFT RPC URL for the Recall Testnet.
 */
export const TESTNET_RPC_URL = "https://api.testnet.recall.chain.love";

/**
 * CometBFT RPC URL for the Recall Localnet.
 */
export const LOCALNET_RPC_URL = "http://127.0.0.1:26657";

/**
 * CometBFT RPC URL for the Recall Devnet.
 */
export const DEVNET_RPC_URL = "http://127.0.0.1:26657";

/**
 * EVM RPC URL for the Recall Testnet.
 */
export const TESTNET_EVM_RPC_URL = "https://evm.testnet.recall.chain.love";

/**
 * EVM WebSocket URL for the Recall Testnet.
 */
export const TESTNET_EVM_WS_URL = "wss://evm.testnet.recall.chain.love";

/**
 * EVM RPC URL for the Testnet parent chain (Filecoin Calibration).
 */
export const TESTNET_PARENT_EVM_RPC_URL =
  "https://api.calibration.node.glif.io/rpc/v1";

/**
 * EVM RPC URL for the Recall Localnet.
 */
export const LOCALNET_EVM_RPC_URL = "http://127.0.0.1:8645";

/**
 * EVM WebSocket URL for the Recall Localnet.
 */
export const LOCALNET_EVM_WS_URL = "ws://127.0.0.1:8645";

/**
 * EVM RPC URL for the Localnet parent chain.
 */
export const LOCALNET_PARENT_EVM_RPC_URL = "http://127.0.0.1:8545";

/**
 * EVM RPC URL for the Recall Devnet.
 */
export const DEVNET_EVM_RPC_URL = "http://127.0.0.1:8545";

/**
 * EVM WebSocket URL for the Recall Devnet.
 */
export const DEVNET_EVM_WS_URL = "ws://127.0.0.1:8545";

/**
 * Object API URL for the Recall Testnet.
 */
export const TESTNET_OBJECT_API_URL =
  "https://objects.testnet.recall.chain.love";

/**
 * Object API URL for the Recall Localnet.
 */
export const LOCALNET_OBJECT_API_URL = "http://127.0.0.1:8001";

/**
 * Object API URL for the Recall Devnet.
 */
export const DEVNET_OBJECT_API_URL = "http://127.0.0.1:8001";

/**
 * Registrar URL for the Recall Testnet.
 */
export const TESTNET_REGISTRAR_URL =
  "https://registrar.node-0.testnet.recall.network";

/**
 * Explorer URL for the Recall Testnet.
 */
export const TESTNET_EXPLORER_URL = "https://explorer.testnet.recall.network";

/**
 * Explorer URL for the Recall Localnet.
 */
export const LOCALNET_EXPLORER_URL = "http://127.0.0.1:8000";

/**
 * Explorer URL for the Recall Devnet.
 */
export const DEVNET_EXPLORER_URL = "http://127.0.0.1:8000";

/**
 * Faucet URL for the Recall Testnet.
 */
export const TESTNET_FAUCET_URL = "https://faucet.recall.network";

/**
 * Timeout in milliseconds for RPC requests.
 */
export const RPC_TIMEOUT = 60_000;

/**
 * Minimum time-to-live (TTL) in seconds for objects stored on the network.
 */
export const MIN_TTL = 3600n; // one hour

/**
 * Maximum object size in bytes that can be stored on the network.
 */
export const MAX_OBJECT_SIZE = 5_000_000_000; // 5GB

/**
 * Maximum number of objects that can be returned in a single query (to avoid hitting gas limits).
 */
export const MAX_QUERY_LIMIT = 50;

/**
 * Gateway Manager Facet contract address for the Testnet parent chain.
 */
export const TESTNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x2758f99EaB8ea9B8678B5d841851D62Ef18AAB26";

/**
 * Gateway Manager Facet contract address for the Recall Testnet.
 */
export const TESTNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";

/**
 * Gateway Manager Facet contract address for the Localnet parent chain.
 */
export const LOCALNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x9A676e781A523b5d0C0e43731313A708CB607508";

/**
 * Gateway Manager Facet contract address for the Recall Localnet.
 */
export const LOCALNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";

/**
 * Gateway Manager Facet contract address for the Recall Devnet.
 */
export const DEVNET_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x77aa40b105843728088c0132e43fc44348881da8";

/**
 * Subnet Getter (Registry) Facet contract address for the Testnet parent chain.
 */
export const TESTNET_PARENT_SUBNET_GETTER_FACET_ADDRESS =
  "0xE8090d55E7ecc0565830845Df67bfD3fA81D4158";

/**
 * Subnet Getter (Registry) Facet contract address for the Localnet parent chain.
 */
export const LOCALNET_PARENT_SUBNET_GETTER_FACET_ADDRESS =
  "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44";

/**
 * Subnet Getter (Registry) Facet contract address for the Recall Testnet.
 */
export const TESTNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";

/**
 * Subnet Getter (Registry) Facet contract address for the Recall Localnet.
 */
export const LOCALNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";

/**
 * Subnet Getter (Registry) Facet contract address for the Recall Devnet.
 */
export const DEVNET_SUBNET_GETTER_FACET_ADDRESS =
  "0x74539671a1d2f1c8f200826baba665179f53a1b7";

/**
 * ERC20 contract address for the Testnet parent chain.
 */
export const TESTNET_PARENT_ERC20_ADDRESS =
  "0xd1239c6b6f806EC3752df12CEaddD88187BCf1E5";

/**
 * ERC20 contract address for the Localnet parent chain.
 */
export const LOCALNET_PARENT_ERC20_ADDRESS =
  "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

/**
 * BlobManager contract address for the Recall Testnet.
 */
export const TESTNET_BLOB_MANAGER_ADDRESS =
  "0x27594F8412bA08278b15b55C6347605Ee3b2020C";

/**
 * BlobManager contract address for the Recall Localnet.
 */
export const LOCALNET_BLOB_MANAGER_ADDRESS =
  "0x8ce361602B935680E8DeC218b820ff5056BeB7af";

/**
 * BucketManager contract address for the Recall Testnet.
 */
export const TESTNET_BUCKET_MANAGER_ADDRESS =
  "0x170a22c76a2Bb7c5F1b0e7067a0ddb7C3452c8e0";

/**
 * BucketManager contract address for the Recall Localnet.
 */
export const LOCALNET_BUCKET_MANAGER_ADDRESS =
  "0xeD1DB453C3156Ff3155a97AD217b3087D5Dc5f6E";

/**
 * CreditManager contract address for the Recall Testnet.
 */
export const TESTNET_CREDIT_MANAGER_ADDRESS =
  "0x296042865b783D8E8Fb09F04FFAE2A66a16B85Bc";

/**
 * CreditManager contract address for the Recall Localnet.
 */
export const LOCALNET_CREDIT_MANAGER_ADDRESS =
  "0x196dBCBb54b8ec4958c959D8949EBFE87aC2Aaaf";
