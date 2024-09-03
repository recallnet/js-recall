import { strictEqual } from "assert";
import { describe, it } from "mocha";
import { SubnetId } from "../src/ipc/subnet.js";
import { Network, NetworkType } from "../src/network.js";
import { LOCALNET_SUBNET_ID } from "../src/network.js";

describe("subnet", function () {
  let subnetId: SubnetId;
  const localnetChainId = 2022913529944675n;

  before(() => {
    subnetId = SubnetId.fromString(LOCALNET_SUBNET_ID);
  });

  it("should be able to be constructed from string", () => {
    strictEqual(subnetId.toString(), LOCALNET_SUBNET_ID);
  });

  it("should be able to be constructed from network", () => {
    const network = new Network(NetworkType.Localnet);
    const subnetId = SubnetId.fromNetwork(network);
    strictEqual(subnetId.toString(), LOCALNET_SUBNET_ID);
  });

  it("should be able to get subnet chain id", () => {
    strictEqual(subnetId.chainId(), localnetChainId);
  });

  it("should be able to get parent subnet", () => {
    const parentChainId = 314159n;
    const parent = subnetId.parent();
    strictEqual(parent?.chainId(), parentChainId);
  });

  it("should get no parent for root subnet", () => {
    const root = subnetId.parent();
    const parentOfRoot = root?.parent();
    strictEqual(parentOfRoot, null);
  });
});
