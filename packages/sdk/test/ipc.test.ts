import { strictEqual } from "assert";
import { expect } from "chai";
import { describe, it } from "mocha";
import {
  DEVNET_CHAIN_ID,
  DEVNET_SUBNET_ID,
  LOCALNET_CHAIN_ID,
  LOCALNET_SUBNET_ID,
  TESTNET_CHAIN_ID,
  TESTNET_SUBNET_ID,
} from "../src/constants.js";
import { SubnetId } from "../src/ipc/subnet.js";
import { Network, NetworkType } from "../src/network.js";

describe("subnet", function () {
  let subnetId: SubnetId;

  before(() => {
    subnetId = SubnetId.fromString(LOCALNET_SUBNET_ID);
  });

  it("should be constructed from subnet id", () => {
    let sub = SubnetId.fromString(LOCALNET_SUBNET_ID);
    strictEqual(sub.toString(), LOCALNET_SUBNET_ID);
    sub = SubnetId.fromString(DEVNET_SUBNET_ID);
    strictEqual(sub.toString(), DEVNET_SUBNET_ID);
    sub = SubnetId.fromString(TESTNET_SUBNET_ID);
    strictEqual(sub.toString(), TESTNET_SUBNET_ID);
  });

  it("should be able to get subnet chain id", () => {
    let sub = SubnetId.fromString(LOCALNET_SUBNET_ID);
    strictEqual(sub.chainId(), LOCALNET_CHAIN_ID);
    sub = SubnetId.fromString(DEVNET_SUBNET_ID);
    strictEqual(sub.chainId(), DEVNET_CHAIN_ID);
    sub = SubnetId.fromString(TESTNET_SUBNET_ID);
    strictEqual(sub.chainId(), TESTNET_CHAIN_ID);
  });

  it("should be able to be constructed from string", () => {
    strictEqual(subnetId.toString(), LOCALNET_SUBNET_ID);
  });

  it("should be able to be constructed from network", () => {
    const network = new Network(NetworkType.Localnet);
    const subnetId = SubnetId.fromNetwork(network);
    strictEqual(subnetId.toString(), LOCALNET_SUBNET_ID);
  });

  it("should be able to get eth and fvm addresses", () => {
    strictEqual(subnetId.real.route[0], "t410fkzrz3mlkyufisiuae3scumllgalzuu3wxlxa2ly");
    strictEqual(subnetId.evm.route[0], "0x56639db16ac50a89228026e42a316b30179a5376");
  });

  it("should be able to get parent subnet", () => {
    const parentChainId = 31337n;
    const parent = subnetId.parent();
    strictEqual(parent?.chainId(), parentChainId);
  });

  it("should fail to get parent for root subnet", () => {
    const root = subnetId.parent();
    expect(() => root.parent()).to.throw(Error, "subnet has no parent");
  });
});
