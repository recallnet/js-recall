import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { base, baseSepolia } from "viem/chains";

import { Network, getChainForNetwork } from "../src/network.js";

describe("Network Coverage", () => {
  it("should return base chain for Network.Base", () => {
    const chain = getChainForNetwork(Network.Base);
    assert.strictEqual(chain.id, base.id);
  });

  it("should return baseSepolia for Network.BaseSepolia", () => {
    const chain = getChainForNetwork(Network.BaseSepolia as Network);
    assert.strictEqual(chain.id, baseSepolia.id);
  });

  it("should return baseSepolia for default case", () => {
    const chain = getChainForNetwork("invalid" as Network);
    assert.strictEqual(chain.id, baseSepolia.id);
  });
});
