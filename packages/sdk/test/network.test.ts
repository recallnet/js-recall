import { expect } from "chai";
import { describe, it } from "mocha";
import { strictEqual } from "node:assert";
import { defineChain } from "viem";

import {
  gatewayManagerFacetAddress,
  recallErc20Address,
  subnetGetterFacetAddress,
} from "@recallnet/contracts";
import {
  DEVNET_CHAIN_ID,
  LOCALNET_CHAIN_ID,
  LOCALNET_EVM_RPC_URL,
  LOCALNET_OBJECT_API_URL,
  LOCALNET_PARENT_CHAIN_ID,
  LOCALNET_PARENT_EVM_RPC_URL,
  LOCALNET_RPC_URL,
  LOCALNET_SUBNET_ID,
  RPC_TIMEOUT,
  TESTNET_CHAIN_ID,
} from "@recallnet/network-constants";

import { Network, NetworkType, chainToNetworkType } from "../src/network.js";

describe("network", function () {
  let network: Network;

  before(() => {
    network = new Network(NetworkType.Localnet);
  });

  it("should be able to be constructed with default", () => {
    const net = new Network();
    strictEqual(net.toString(), "testnet");
  });

  it("should be able to be constructed from network type", () => {
    const net = new Network(NetworkType.Testnet);
    strictEqual(net.toString(), "testnet");
  });

  it("should be able to be constructed from string", () => {
    strictEqual(network.toString(), "localnet");
  });

  it("should throw error if invalid or mainnet network", () => {
    expect(() => Network.fromString("invalid")).to.throw("invalid network");
    expect(() => Network.fromString("mainnet")).to.throw(
      "network is pre-mainnet",
    );
  });

  it("should get correct cometbft rpc url", () => {
    strictEqual(network.consensusRpcUrl(), LOCALNET_RPC_URL);
  });

  it("should get correct object api url", () => {
    strictEqual(network.objectApiUrl(), LOCALNET_OBJECT_API_URL);
  });

  it("should return correct subnet config", () => {
    const net = Network.fromString("localnet");
    const config = net.subnetConfig();
    strictEqual(config.id?.toString(), LOCALNET_SUBNET_ID);
    strictEqual(config.providerHttp, LOCALNET_EVM_RPC_URL);
    strictEqual(config.providerTimeout, RPC_TIMEOUT);
    strictEqual(
      config.registryAddr,
      subnetGetterFacetAddress[LOCALNET_CHAIN_ID],
    );
    strictEqual(
      config.gatewayAddr,
      gatewayManagerFacetAddress[LOCALNET_CHAIN_ID],
    );
    strictEqual(config.authToken, undefined);
    strictEqual(config.supplySource, undefined);
  });

  it("should return correct parent config", () => {
    const net = Network.fromString("localnet");
    const config = net.parentSubnetConfig();
    strictEqual(config.id?.toString(), "/r31337");
    strictEqual(config.providerHttp, LOCALNET_PARENT_EVM_RPC_URL);
    strictEqual(config.providerTimeout, RPC_TIMEOUT);
    strictEqual(
      config.registryAddr,
      subnetGetterFacetAddress[LOCALNET_PARENT_CHAIN_ID],
    );
    strictEqual(
      config.gatewayAddr,
      gatewayManagerFacetAddress[LOCALNET_PARENT_CHAIN_ID],
    );
    strictEqual(config.authToken, undefined);
    strictEqual(
      config.supplySource,
      recallErc20Address[LOCALNET_PARENT_CHAIN_ID],
    );
  });

  it("should convert user-defined chains to network type", () => {
    const chain1 = defineChain({
      id: LOCALNET_CHAIN_ID,
      name: "localnet",
      nativeCurrency: {
        name: "localnet",
        symbol: "localnet",
        decimals: 18,
      },
      rpcUrls: {
        default: { http: ["https://rpc.recall.network"] },
      },
    });
    let net = chainToNetworkType(chain1);
    strictEqual(net, NetworkType.Localnet);

    const chain2 = defineChain({
      id: TESTNET_CHAIN_ID,
      name: "testnet",
      nativeCurrency: {
        name: "testnet",
        symbol: "testnet",
        decimals: 18,
      },
      rpcUrls: {
        default: { http: ["https://rpc.recall.network"] },
      },
    });
    net = chainToNetworkType(chain2);
    strictEqual(net, NetworkType.Testnet);

    const chain3 = defineChain({
      id: DEVNET_CHAIN_ID,
      name: "devnet",
      nativeCurrency: {
        name: "devnet",
        symbol: "devnet",
        decimals: 18,
      },
      rpcUrls: {
        default: { http: ["https://rpc.recall.network"] },
      },
    });
    net = chainToNetworkType(chain3);
    strictEqual(net, NetworkType.Devnet);
  });
});
