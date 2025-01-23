import { expect } from "chai";
import { describe, it } from "mocha";
import { strictEqual } from "node:assert";

import {
  LOCALNET_EVM_GATEWAY_ADDRESS,
  LOCALNET_EVM_REGISTRY_ADDRESS,
  LOCALNET_EVM_RPC_URL,
  LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS,
  LOCALNET_OBJECT_API_URL,
  LOCALNET_PARENT_EVM_GATEWAY_ADDRESS,
  LOCALNET_PARENT_EVM_REGISTRY_ADDRESS,
  LOCALNET_PARENT_EVM_RPC_URL,
  LOCALNET_RPC_URL,
  LOCALNET_SUBNET_ID,
  RPC_TIMEOUT,
} from "../src/constants.js";
import { Network, NetworkType } from "../src/network.js";

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
    strictEqual(config.registryAddr, LOCALNET_EVM_REGISTRY_ADDRESS);
    strictEqual(config.gatewayAddr, LOCALNET_EVM_GATEWAY_ADDRESS);
    strictEqual(config.authToken, undefined);
    strictEqual(config.supplySource, undefined);
  });

  it("should return correct parent config", () => {
    const net = Network.fromString("localnet");
    const config = net.parentSubnetConfig();
    strictEqual(config.id?.toString(), "/r31337");
    strictEqual(config.providerHttp, LOCALNET_PARENT_EVM_RPC_URL);
    strictEqual(config.providerTimeout, RPC_TIMEOUT);
    strictEqual(config.registryAddr, LOCALNET_PARENT_EVM_REGISTRY_ADDRESS);
    strictEqual(config.gatewayAddr, LOCALNET_PARENT_EVM_GATEWAY_ADDRESS);
    strictEqual(config.authToken, undefined);
    strictEqual(config.supplySource, LOCALNET_EVM_SUPPLY_SOURCE_ADDRESS);
  });
});
