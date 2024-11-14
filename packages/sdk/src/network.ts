import { SubnetId, subnetIdStringToChainId } from "./ipc/subnet.js";

export const TESTNET_SUBNET_ID = "/r314159/t410f2x3jiwcg6ju4bvy2lpdzc6xjo5okoktdm63mwni";
export const LOCALNET_SUBNET_ID = "/r31337/t410fkzrz3mlkyufisiuae3scumllgalzuu3wxlxa2ly";
export const DEVNET_SUBNET_ID = "test";

export const TESTNET_CHAIN_ID = subnetIdStringToChainId(TESTNET_SUBNET_ID); // 2009180146406958
export const LOCALNET_CHAIN_ID = subnetIdStringToChainId(LOCALNET_SUBNET_ID); // 4362550583360910
export const DEVNET_CHAIN_ID = subnetIdStringToChainId(DEVNET_SUBNET_ID); // 1942764459484029

export const TESTNET_RPC_URL = "https://api-ignition-0.hoku.sh";
export const LOCALNET_RPC_URL = "http://127.0.0.1:26657";
export const DEVNET_RPC_URL = LOCALNET_RPC_URL;

export const TESTNET_EVM_RPC_URL = "https://evm-ignition-0.hoku.sh";
export const LOCALNET_EVM_RPC_URL = "http://127.0.0.1:8645";
export const DEVNET_EVM_RPC_URL = "http://127.0.0.1:8545";
export const TESTNET_EVM_WS_URL = "wss://evm-ignition-0.hoku.sh";
export const LOCALNET_EVM_WS_URL = "ws://127.0.0.1:8645";
export const DEVNET_EVM_WS_URL = "ws://127.0.0.1:8545";

export const TESTNET_OBJECT_API_URL = "https://object-api-ignition-0.hoku.sh";
export const LOCALNET_OBJECT_API_URL = "http://127.0.0.1:8001";
export const DEVNET_OBJECT_API_URL = LOCALNET_OBJECT_API_URL;

export const RPC_TIMEOUT = 60_000;

export const TESTNET_EVM_GATEWAY_ADDRESS = "0x77aa40b105843728088c0132e43fc44348881da8";
export const TESTNET_EVM_REGISTRY_ADDRESS = "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const TESTNET_EVM_SUPPLY_SOURCE_ADDRESS = "0x20d8a696091153c4d4816ba1fdefe113f71e0905";
export const LOCALNET_EVM_GATEWAY_ADDRESS = "0x77aa40b105843728088c0132e43fc44348881da8";
export const LOCALNET_EVM_REGISTRY_ADDRESS = "0x74539671a1d2f1c8f200826baba665179f53a1b7";
export const LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS = "0xE6E340D132b5f46d1e472DebcD681B2aBc16e57E";
export const DEVNET_EVM_GATEWAY_ADDRESS = "0x77aa40b105843728088c0132e43fc44348881da8";
export const DEVNET_EVM_REGISTRY_ADDRESS = "0x74539671a1d2f1c8f200826baba665179f53a1b7";

export const TESTNET_PARENT_EVM_RPC_URL = "https://api.calibration.node.glif.io/rpc/v1";
export const TESTNET_PARENT_EVM_GATEWAY_ADDRESS = "0xe17B86E7BEFC691DAEfe2086e56B86D4253f3294";
export const TESTNET_PARENT_EVM_REGISTRY_ADDRESS = "0xe87AFBEC26f0fdAC69e4256dC1935bEab1e0855E";
export const LOCALNET_PARENT_EVM_RPC_URL = "http://127.0.0.1:8545";
export const LOCALNET_PARENT_EVM_GATEWAY_ADDRESS = "0x9A676e781A523b5d0C0e43731313A708CB607508";
export const LOCALNET_PARENT_EVM_REGISTRY_ADDRESS = "0x4ed7c70F96B99c776995fB64377f0d4aB3B0e1C1";

// Network presets.
export enum NetworkType {
  // Network presets for mainnet.
  Mainnet,
  // Network presets for Calibration (default pre-mainnet).
  Testnet,
  // Network presets for a local three-node network.
  Localnet,
  // Network presets for local development.
  Devnet,
}

// EVM subnet config.
export type EvmSubnet = {
  // The target subnet ID.
  id: SubnetId;
  // The EVM RPC provider endpoint.
  providerHttp: string;
  // The EVM RPC provider request timeout.
  providerTimeout?: number | undefined;
  // The EVM RPC provider authorization token.
  authToken?: string | undefined;
  // The EVM registry contract address.
  registryAddr: string;
  // The EVM gateway contract address.
  gatewayAddr: string;
  // The EVM supply source contract address.
  supplySource?: string | undefined;
};

// EVM subnet config options.
export type SubnetRpcOptions = {
  // The EVM RPC provider request timeout.
  evmRpcTimeout?: number;
  // The EVM RPC provider authorization token.
  evmRpcAuthToken?: string;
};

// Network configuration.
export class Network {
  private networkType: NetworkType;

  constructor(networkType: NetworkType = NetworkType.Testnet) {
    switch (networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
      case NetworkType.Localnet:
      case NetworkType.Devnet:
        this.networkType = networkType;
    }
  }

  // Returns an instance of the `Network` for the given network type.
  static fromString(network: string): Network {
    switch (network) {
      case "mainnet":
        return new Network(NetworkType.Mainnet);
      case "testnet":
        return new Network(NetworkType.Testnet);
      case "localnet":
        return new Network(NetworkType.Localnet);
      case "devnet":
        return new Network(NetworkType.Devnet);
      default:
        throw new Error("invalid network");
    }
  }

  // Returns the network type as a string.
  toString(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        return "mainnet";
      case NetworkType.Testnet:
        return "testnet";
      case NetworkType.Localnet:
        return "localnet";
      case NetworkType.Devnet:
        return "devnet";
    }
  }

  // Returns the network type.
  type(): NetworkType {
    return this.networkType;
  }

  // Returns an instance of the SubnetId.
  subnetId(): SubnetId {
    return SubnetId.fromNetwork(this);
  }

  // Returns an instance of the `EvmSubnet` config.
  subnetConfig(options?: SubnetRpcOptions): EvmSubnet {
    return {
      id: this.subnetId(),
      providerHttp: this.evmRpcUrl(),
      providerTimeout: options?.evmRpcTimeout ?? RPC_TIMEOUT,
      registryAddr: this.evmRegistry(),
      gatewayAddr: this.evmGateway(),
      authToken: options?.evmRpcAuthToken,
    };
  }

  // Returns the CometBFT RPC URL for the network's consensus layer.
  consensusRpcUrl(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_RPC_URL;
      case NetworkType.Localnet:
      case NetworkType.Devnet:
        return LOCALNET_RPC_URL;
    }
  }

  // Returns the Object API URL for the network.
  objectApiUrl(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_OBJECT_API_URL;
      case NetworkType.Localnet:
      case NetworkType.Devnet:
        return LOCALNET_OBJECT_API_URL;
    }
  }

  // Returns the subnet EVM RPC URL.
  evmRpcUrl(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_EVM_RPC_URL;
      case NetworkType.Localnet:
        return LOCALNET_EVM_RPC_URL;
      case NetworkType.Devnet:
        return DEVNET_EVM_RPC_URL;
    }
  }

  // Returns the subnet EVM gateway address.
  evmGateway(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_EVM_GATEWAY_ADDRESS;
      case NetworkType.Localnet:
        return LOCALNET_EVM_GATEWAY_ADDRESS;
      case NetworkType.Devnet:
        return DEVNET_EVM_GATEWAY_ADDRESS;
    }
  }

  // Returns the subnet EVM registry address.
  evmRegistry(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_EVM_REGISTRY_ADDRESS;
      case NetworkType.Localnet:
        return LOCALNET_EVM_REGISTRY_ADDRESS;
      case NetworkType.Devnet:
        return DEVNET_EVM_REGISTRY_ADDRESS;
    }
  }

  // Returns an instance of the `EvmSubnet` config for the parent network.
  parentSubnetConfig(options?: SubnetRpcOptions): EvmSubnet {
    return {
      id: this.subnetId().parent(), // TODO: this differs from Rust SDK
      providerHttp: this.parentEvmRpcUrl(),
      providerTimeout: options?.evmRpcTimeout ?? RPC_TIMEOUT,
      registryAddr: this.parentEvmRegistry(),
      gatewayAddr: this.parentEvmGateway(),
      authToken: options?.evmRpcAuthToken,
      supplySource: this.parentEvmSupplySource(),
    };
  }

  // Returns the parent network EVM RPC URL.
  parentEvmRpcUrl(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_PARENT_EVM_RPC_URL;
      case NetworkType.Localnet:
        return LOCALNET_PARENT_EVM_RPC_URL;
      case NetworkType.Devnet:
        throw new Error("network has no parent");
    }
  }

  // Returns the parent network EVM gateway address.
  parentEvmGateway(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_PARENT_EVM_GATEWAY_ADDRESS;
      case NetworkType.Localnet:
        return LOCALNET_PARENT_EVM_GATEWAY_ADDRESS;
      case NetworkType.Devnet:
        throw new Error("network has no parent");
    }
  }

  // Returns the parent network EVM registry address.
  parentEvmRegistry(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_PARENT_EVM_REGISTRY_ADDRESS;
      case NetworkType.Localnet:
        return LOCALNET_PARENT_EVM_REGISTRY_ADDRESS;
      case NetworkType.Devnet:
        throw new Error("network has no parent");
    }
  }

  // Returns the parent network EVM supply source address.
  parentEvmSupplySource(): string {
    switch (this.networkType) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return TESTNET_EVM_SUPPLY_SOURCE_ADDRESS;
      case NetworkType.Localnet:
        return LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS;
      case NetworkType.Devnet:
        throw new Error("network has no parent");
    }
  }
}
