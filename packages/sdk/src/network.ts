import { Chain } from "viem";
import {
  ChainName,
  devnet,
  getChain,
  getParentChain,
  localnet,
  testnet,
} from "./chains.js";
import {
  DEVNET_EVM_GATEWAY_ADDRESS,
  DEVNET_EVM_REGISTRY_ADDRESS,
  DEVNET_EVM_RPC_URL,
  DEVNET_OBJECT_API_URL,
  DEVNET_RPC_URL,
  LOCALNET_EVM_GATEWAY_ADDRESS,
  LOCALNET_EVM_REGISTRY_ADDRESS,
  LOCALNET_EVM_RPC_URL,
  LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS,
  LOCALNET_OBJECT_API_URL,
  LOCALNET_PARENT_EVM_GATEWAY_ADDRESS,
  LOCALNET_PARENT_EVM_REGISTRY_ADDRESS,
  LOCALNET_PARENT_EVM_RPC_URL,
  LOCALNET_RPC_URL,
  RPC_TIMEOUT,
  TESTNET_EVM_GATEWAY_ADDRESS,
  TESTNET_EVM_REGISTRY_ADDRESS,
  TESTNET_EVM_RPC_URL,
  TESTNET_EVM_SUPPLY_SOURCE_ADDRESS,
  TESTNET_OBJECT_API_URL,
  TESTNET_PARENT_EVM_GATEWAY_ADDRESS,
  TESTNET_PARENT_EVM_REGISTRY_ADDRESS,
  TESTNET_PARENT_EVM_RPC_URL,
  TESTNET_RPC_URL,
} from "./constants.js";
import { SubnetId } from "./ipc/subnet.js";

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

// Converts a chain name to a network type
function chainNameToNetworkType(chainName: ChainName): NetworkType {
  switch (chainName) {
    case "mainnet":
      return NetworkType.Mainnet;
    case "testnet":
      return NetworkType.Testnet;
    case "localnet":
      return NetworkType.Localnet;
    case "devnet":
      return NetworkType.Devnet;
    default:
      throw new Error("invalid chain name");
  }
}

// Converts a network type to a chain name
function networkTypeToChainName(networkType: NetworkType): ChainName {
  switch (networkType) {
    case NetworkType.Mainnet:
      throw new Error("network is pre-mainnet");
    case NetworkType.Testnet:
      return "testnet";
    case NetworkType.Localnet:
      return "localnet";
    case NetworkType.Devnet:
      return "devnet";
  }
}

// Converts a network type to a chain
export function networkTypeToChain(networkType: NetworkType): Chain {
  switch (networkType) {
    case NetworkType.Mainnet:
      throw new Error("network is pre-mainnet");
    case NetworkType.Testnet:
      return testnet;
    case NetworkType.Localnet:
      return localnet;
    case NetworkType.Devnet:
      return devnet;
  }
}

// Converts a chain to a network type
export function chainToNetworkType(chain: Chain): NetworkType {
  switch (chain) {
    case testnet:
      return NetworkType.Testnet;
    case localnet:
      return NetworkType.Localnet;
    case devnet:
      return NetworkType.Devnet;
    default:
      throw new Error("invalid chain");
  }
}

// EVM subnet config.
export type SubnetConfig = {
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
  // Chain information
  chain: Chain | undefined;
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

  // Creates a Network from a chain name
  static fromChainName(chainName: ChainName): Network {
    return new Network(chainNameToNetworkType(chainName));
  }

  // Creates a Network from a chain
  static fromChain(chain: Chain): Network {
    return new Network(chainToNetworkType(chain));
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

  // Returns an instance of the `Subnet` config.
  subnetConfig(options?: SubnetRpcOptions): SubnetConfig {
    return {
      id: this.subnetId(),
      providerHttp: this.evmRpcUrl(),
      providerTimeout: options?.evmRpcTimeout ?? RPC_TIMEOUT,
      registryAddr: this.evmRegistry(),
      gatewayAddr: this.evmGateway(),
      authToken: options?.evmRpcAuthToken,
      chain: this.getChain(),
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
        return LOCALNET_RPC_URL;
      case NetworkType.Devnet:
        return DEVNET_RPC_URL;
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
        return LOCALNET_OBJECT_API_URL;
      case NetworkType.Devnet:
        return DEVNET_OBJECT_API_URL;
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

  // Returns an instance of the `Subnet` config for the parent network.
  parentSubnetConfig(options?: SubnetRpcOptions): SubnetConfig {
    return {
      id: this.subnetId().parent(), // TODO: this differs from Rust SDK
      providerHttp: this.parentEvmRpcUrl(),
      providerTimeout: options?.evmRpcTimeout ?? RPC_TIMEOUT,
      registryAddr: this.parentEvmRegistry(),
      gatewayAddr: this.parentEvmGateway(),
      authToken: options?.evmRpcAuthToken,
      supplySource: this.parentEvmSupplySource(),
      chain: this.getParentChain(),
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

  // Returns the chain for the network
  getChain(): Chain {
    return getChain(networkTypeToChainName(this.networkType));
  }

  // Returns the parent chain for the network
  getParentChain(): Chain | undefined {
    return getParentChain(this.getChain());
  }
}
