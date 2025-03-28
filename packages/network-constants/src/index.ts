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
  "/r314159/t410frrql2ooeoz2t4hlor3hqw33druwnc4jzhajdbeq";

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
  "https://faucet.node-0.testnet.recall.network";

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
 * Gateway Manager Facet contract address for the Testnet parent chain.
 */
export const TESTNET_PARENT_GATEWAY_MANAGER_FACET_ADDRESS =
  "0x136066500b332e7D72643EE7690E9C708702c7e6";

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
  "0xdf3Fe12002826Ff617F2d7500c61B72A8e3E9436";

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
  "0x9E5ea73a639484CcE57F865dC1E582Cd01F3251F";

/**
 * ERC20 contract address for the Localnet parent chain.
 */
export const LOCALNET_PARENT_ERC20_ADDRESS =
  "0x4A679253410272dd5232B3Ff7cF5dbB88f295319";

/**
 * BlobManager contract address for the Recall Testnet.
 */
export const TESTNET_BLOB_MANAGER_ADDRESS =
  "0x6E3f94065567560c6e1Bbc5e4584127220c15e14";

/**
 * BlobManager contract address for the Recall Localnet.
 */
export const LOCALNET_BLOB_MANAGER_ADDRESS =
  "0x8ce361602B935680E8DeC218b820ff5056BeB7af";

/**
 * BucketManager contract address for the Recall Testnet.
 */
export const TESTNET_BUCKET_MANAGER_ADDRESS =
  "0x7a9Cec860adF2C64274D0aD7fbF0b5Bf0426a200";

/**
 * BucketManager contract address for the Recall Localnet.
 */
export const LOCALNET_BUCKET_MANAGER_ADDRESS =
  "0xeD1DB453C3156Ff3155a97AD217b3087D5Dc5f6E";

/**
 * CreditManager contract address for the Recall Testnet.
 */
export const TESTNET_CREDIT_MANAGER_ADDRESS =
  "0x61F50eEC83043a4635956B54EEDf5Eea8CcaBc76";

/**
 * CreditManager contract address for the Recall Localnet.
 */
export const LOCALNET_CREDIT_MANAGER_ADDRESS =
  "0x196dBCBb54b8ec4958c959D8949EBFE87aC2Aaaf";
