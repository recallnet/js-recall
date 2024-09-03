import { strictEqual } from "assert";
import { expect } from "chai";
import { describe, it } from "mocha";
import { Network, NetworkType } from "../src/network.js";
import {
  LOCALNET_OBJECT_API_URL,
  LOCALNET_RPC_URL,
  RPC_TIMEOUT,
  TESTNET_EVM_GATEWAY_ADDRESS,
  TESTNET_EVM_REGISTRY_ADDRESS,
  TESTNET_EVM_RPC_URL,
  TESTNET_EVM_SUPPLY_SOURCE_ADDRESS,
  TESTNET_PARENT_EVM_GATEWAY_ADDRESS,
  TESTNET_PARENT_EVM_REGISTRY_ADDRESS,
  TESTNET_PARENT_EVM_RPC_URL,
  TESTNET_SUBNET_ID,
} from "../src/network.js";

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
      "network is pre-mainnet"
    );
  });

  it("should get correct cometbft rpc url", () => {
    strictEqual(network.consensusRpcUrl(), LOCALNET_RPC_URL);
  });

  it("should get correct object api url", () => {
    strictEqual(network.objectApiUrl(), LOCALNET_OBJECT_API_URL);
  });

  it("should return correct subnet config", () => {
    const net = Network.fromString("testnet");
    const config = net.subnetConfig();
    strictEqual(config.id?.toString(), TESTNET_SUBNET_ID);
    strictEqual(config.providerHttp, TESTNET_EVM_RPC_URL);
    strictEqual(config.providerTimeout, RPC_TIMEOUT);
    strictEqual(config.registryAddr, TESTNET_EVM_REGISTRY_ADDRESS);
    strictEqual(config.gatewayAddr, TESTNET_EVM_GATEWAY_ADDRESS);
    strictEqual(config.authToken, undefined);
    strictEqual(config.supplySource, undefined);
  });

  it("should return correct parent config", () => {
    const net = Network.fromString("testnet");
    const config = net.parentSubnetConfig();
    strictEqual(config.id?.toString(), TESTNET_SUBNET_ID);
    strictEqual(config.providerHttp, TESTNET_PARENT_EVM_RPC_URL);
    strictEqual(config.providerTimeout, RPC_TIMEOUT);
    strictEqual(config.registryAddr, TESTNET_PARENT_EVM_REGISTRY_ADDRESS);
    strictEqual(config.gatewayAddr, TESTNET_PARENT_EVM_GATEWAY_ADDRESS);
    strictEqual(config.authToken, undefined);
    strictEqual(config.supplySource, TESTNET_EVM_SUPPLY_SOURCE_ADDRESS);
  });
});
