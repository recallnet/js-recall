import { Address, FilEthAddress, toBigInt } from "@hokunet/fvm";
import fnv1a from "@sindresorhus/fnv1a";
import {
  DEVNET_SUBNET_ID,
  LOCALNET_SUBNET_ID,
  Network,
  NetworkType,
  TESTNET_SUBNET_ID,
} from "../network.js";

export type SubnetIdStruct = {
  root: bigint;
  route: string[];
};

type AddressType = "evm" | "fvm";

export class SubnetId {
  faux: string;
  real: SubnetIdStruct; // Uses FVM addresses
  evm: SubnetIdStruct; // Uses EVM addresses

  constructor(root: bigint, route: string[], faux: string = "") {
    const rootAsBigint = toBigInt(root);
    this.real = {
      root: rootAsBigint,
      route,
    };
    const evmRoute =
      route.length > 0
        ? route.map((a) => (Address.fromString(a) as FilEthAddress).toEthAddressHex())
        : [];
    this.evm = {
      root: rootAsBigint,
      route: evmRoute,
    };
    this.faux = faux;
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
    if (!subnetIdStr.toString().startsWith("/r")) {
      return new SubnetId(0n, [], subnetIdStr);
    }
    const [, rootRaw, routeRaw] = subnetIdStr.split("/");
    const root = toBigInt(rootRaw.slice(1)); // Remove the "r" prefix
    const route = routeRaw ? routeRaw.split("/") : [];
    return new SubnetId(root, route, "");
  }

  isRoot(): boolean {
    return this.real.route.length === 0;
  }

  rootId(): bigint {
    return toBigInt(this.real.root);
  }

  toString(): string {
    if (this.isRoot()) {
      return this.faux.length === 0 ? `/r${this.real.root}` : this.faux;
    }
    const route = this.real.route.join("/");
    return `/r${this.real.root}/${route}`;
  }

  // See here for how this is derived as per EIP-2294:
  // https://github.com/consensus-shipyard/ipc/blob/13e5da5572b5c0de09f5481ef6c679efee0da14c/fendermint/vm/core/src/chainid.rs#L52
  chainId(): bigint {
    if (this.isRoot() && this.faux.length === 0) {
      return this.real.root;
    }
    const maxChainId = 4503599627370476n;
    const hash = (value: string) => fnv1a(value, { size: 64 }) % maxChainId;
    return hash(this.toString());
  }

  subnetActorAddress(type: AddressType = "evm"): string | null {
    if (this.isRoot()) {
      return null;
    }
    return type === "evm" ? this.evm.route[-1] : this.real.route[-1];
  }

  parent(): SubnetId {
    // If the subnet is the root (no children routes), it has no parent
    if (this.real.route.length === 0) {
      throw new Error("subnet has no parent");
    }
    const parentRoute = this.real.route.slice(0, -1);
    return new SubnetId(this.real.root, parentRoute, "");
  }
}

export function subnetIdStringToChainId(subnetId: string): bigint {
  const subnet = SubnetId.fromString(subnetId);
  return subnet.chainId();
}
