import fnv1a from "@sindresorhus/fnv1a";
import { Chain } from "viem";

import { FilEthAddress } from "@recall/fvm";

import {
  DEVNET_CHAIN_ID,
  DEVNET_SUBNET_ID,
  LOCALNET_CHAIN_ID,
  LOCALNET_SUBNET_ID,
  TESTNET_CHAIN_ID,
  TESTNET_SUBNET_ID,
} from "../constants.js";
import { Network, NetworkType } from "../network.js";

// Format used by IPC Gateway wrappers, with the `root` field change to a `number` instead of a `bigint`
export type SubnetIdStruct = {
  root: number;
  route: string[];
};

// Address type when getting the subnet actor address
export type AddressType = "evm" | "fvm";

// Subnet root, route, and chain ID information for FVM and EVM
export class SubnetId {
  faux: string;
  real: SubnetIdStruct; // Uses FVM addresses
  evm: SubnetIdStruct; // Uses EVM addresses
  explicitChainId: number | undefined;

  constructor(
    root: number,
    route: string[],
    chainId: number | undefined,
    faux: string = "",
  ) {
    this.real = {
      root,
      route,
    };
    const evmRoute =
      route.length > 0
        ? route.map((a) => FilEthAddress.fromString(a).toEthAddressHex())
        : [];
    this.evm = {
      root,
      route: evmRoute,
    };
    this.faux = faux;
    this.explicitChainId = chainId;
  }

  // Create a subnet ID from a string, like "/r31337/t410..."
  static fromString(subnetIdStr: string): SubnetId {
    if (!subnetIdStr.toString().startsWith("/r")) {
      return new SubnetId(0, [], undefined, subnetIdStr);
    }
    const [, rootRaw, routeRaw] = subnetIdStr.split("/");
    const root = Number(rootRaw?.slice(1)); // Remove the "r" prefix
    const route = routeRaw ? routeRaw.split("/") : [];
    let chainId: number | undefined;
    switch (subnetIdStr) {
      case TESTNET_SUBNET_ID:
        chainId = TESTNET_CHAIN_ID;
        break;
      case LOCALNET_SUBNET_ID:
        chainId = LOCALNET_CHAIN_ID;
        break;
      case DEVNET_SUBNET_ID:
        chainId = DEVNET_CHAIN_ID;
        break;
    }
    return new SubnetId(root, route, chainId, subnetIdStr);
  }

  // Create a subnet ID from an official chain
  static fromChain(chain: Chain): SubnetId {
    switch (chain.id) {
      case TESTNET_CHAIN_ID:
        return SubnetId.fromString(TESTNET_SUBNET_ID);
      case LOCALNET_CHAIN_ID:
        return SubnetId.fromString(LOCALNET_SUBNET_ID);
      case DEVNET_CHAIN_ID:
        return SubnetId.fromString(DEVNET_SUBNET_ID);
      default:
        throw new Error("invalid chain id");
    }
  }

  // Create a subnet ID from a network enum value
  static fromNetwork(network: Network): SubnetId {
    switch (network.type()) {
      case NetworkType.Mainnet:
        throw new Error("network is pre-mainnet");
      case NetworkType.Testnet:
        return SubnetId.fromString(TESTNET_SUBNET_ID);
      case NetworkType.Localnet:
        return SubnetId.fromString(LOCALNET_SUBNET_ID);
      case NetworkType.Devnet:
        return SubnetId.fromString(DEVNET_SUBNET_ID);
    }
  }

  // Create a new subnet ID with a specific chain ID
  withChainId(chainId: number): SubnetId {
    return new SubnetId(this.real.root, this.real.route, chainId, this.faux);
  }

  // Set the chain ID for this subnet ID
  setChainId(chainId: number): void {
    this.explicitChainId = chainId;
  }

  // Check if this subnet ID is the root subnet
  isRoot(): boolean {
    return this.real.route.length === 0;
  }

  // Get the root ID for this subnet ID
  rootId(): number {
    return this.real.root;
  }

  // Get the string representation of this subnet ID (e.g. FVM-style, like `/r31337/t410...`)
  toString(): string {
    if (this.isRoot()) {
      return this.faux.length === 0 ? `/r${this.real.root}` : this.faux;
    }
    const route = this.real.route.join("/");
    return `/r${this.real.root}/${route}`;
  }

  // Get the chain ID for this subnet ID
  // See here for how this is derived as per EIP-2294:
  // https://github.com/consensus-shipyard/ipc/blob/13e5da5572b5c0de09f5481ef6c679efee0da14c/fendermint/vm/core/src/chainid.rs#L52
  chainId(): number {
    if (this.explicitChainId !== undefined) {
      return this.explicitChainId;
    }
    if (this.isRoot() && this.faux.length === 0) {
      return this.real.root;
    }
    const maxChainId = 4503599627370476n;
    const hash = (value: string) => fnv1a(value, { size: 64 }) % maxChainId;
    return Number(hash(this.toString()));
  }

  // Get the subnet actor address for this subnet ID
  subnetActorAddress(type: AddressType = "evm"): string | undefined {
    if (this.isRoot()) {
      return undefined;
    }
    return type === "evm" ? this.evm.route[-1] : this.real.route[-1];
  }

  // Get the parent subnet ID for this subnet ID
  parent(): SubnetId {
    // If the subnet is the root (no children routes), it has no parent
    if (this.real.route.length === 0) {
      throw new Error("subnet has no parent");
    }
    const parentRoute = this.real.route.slice(0, -1);
    return new SubnetId(this.real.root, parentRoute, undefined, "");
  }
}
