import { expect } from "chai";
import { describe, it } from "mocha";
import { strictEqual } from "node:assert";

import {
  DEVNET_CHAIN_ID,
  DEVNET_SUBNET_ID,
  LOCALNET_CHAIN_ID,
  LOCALNET_SUBNET_ID,
  TESTNET_CHAIN_ID,
  TESTNET_SUBNET_ID,
} from "@recallnet/network-constants";

import { SubnetId } from "../src/ipc/subnet.js";

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

  it("should be able to get eth and fvm addresses", () => {
    strictEqual(
      subnetId.real.route[0],
      "t410f6gbdxrbehnaeeo4mrq7wc5hgq6smnefys4qanwi",
    );
    strictEqual(
      subnetId.evm.route[0],
      "0xf1823bc4243b40423b8c8c3f6174e687a4c690b8",
    );
  });

  it("should be able to get parent subnet", () => {
    const parentChainId = 31337;
    const parent = subnetId.parent();
    strictEqual(parent?.chainId(), parentChainId);
  });

  it("should fail to get parent for root subnet", () => {
    const root = subnetId.parent();
    expect(() => root.parent()).to.throw(Error, "subnet has no parent");
  });
});
