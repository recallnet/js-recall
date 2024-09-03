import { ethAddressFromDelegated } from "@glif/filecoin-address";
import fnv1a from "@sindresorhus/fnv1a";
import { BigNumberish } from "ethers";
import {
  DEVNET_SUBNET_ID,
  LOCALNET_SUBNET_ID,
  Network,
  NetworkType,
  TESTNET_SUBNET_ID,
} from "../network.js";
import { SubnetIdStruct } from "./contracts.js";

export class SubnetId {
  faux: string;
  real: SubnetIdStruct; // Uses FVM addresses
  evm: SubnetIdStruct; // Uses EVM addresses

  constructor(root: BigNumberish, route: string[]) {
    this.real = {
      root: BigInt(root),
      route: route,
    };
    this.evm = {
      root: BigInt(root),
      route: route.map((a) => ethAddressFromDelegated(a)),
    };
    this.faux = this.toString();
  }

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

  static fromString(subnetIdStr: string): SubnetId {
    const [, rootRaw, routeRaw] = subnetIdStr.split("/");
    const root = BigInt(rootRaw.slice(1));
    const route = routeRaw.split("/");
    return new SubnetId(root, route);
  }

  toString(): string {
    const route = this.real.route.join("/");
    return route ? `/r${this.real.root}/${route}` : `/r${this.real.root}`;
  }

  chainId(): bigint {
    // If the subnet is the root, then the chain ID is the root
    if (this.real.route.length === 0) {
      return BigInt(this.real.root);
    }
    // See here for how this is derived as per EIP-2294:
    // https://github.com/consensus-shipyard/ipc/blob/13e5da5572b5c0de09f5481ef6c679efee0da14c/fendermint/vm/core/src/chainid.rs#L52
    const maxChainId = 4503599627370476n;
    const hash = fnv1a(this.toString(), { size: 64 });
    return hash % maxChainId;
  }

  parent(): SubnetId | null {
    // If the subnet is the root (no children routes), it has no parent
    if (this.real.route.length === 0) {
      return null;
    }
    const parentRoute = this.real.route.slice(0, -1);
    return new SubnetId(this.real.root, parentRoute);
  }
}
