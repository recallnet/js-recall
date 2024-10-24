import { strictEqual } from "assert";
import { describe, it } from "mocha";
import { SubnetId } from "../src/ipc/subnet.js";
import { Network, NetworkType } from "../src/network.js";
import { LOCALNET_SUBNET_ID } from "../src/network.js";

describe.only("subnet", function () {
  let subnetId: SubnetId;
  const localnetChainId = 3620398568294336n;

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

  it("should be able to get eth and fvm addresses", () => {
    strictEqual(
      subnetId.real.route[0],
      "t410f6dl55afbyjbpupdtrmedyqrnmxdmpk7rxuduafq"
    );
    strictEqual(
      subnetId.evm.route[0],
      "0xf0d7de80a1c242fa3c738b083c422d65c6c7abf1"
    );
  });

  it("should be able to get parent subnet", () => {
    const parentChainId = 31337n;
    const parent = subnetId.parent();
    strictEqual(parent?.chainId(), parentChainId);
  });

  it("should get no parent for root subnet", () => {
    const root = subnetId.parent();
    const parentOfRoot = root?.parent();
    strictEqual(parentOfRoot, null);
  });
});
