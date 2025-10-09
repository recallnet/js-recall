import { base, baseSepolia, hardhat } from "viem/chains";
import { describe, expect, it } from "vitest";

import { Network, getChainForNetwork } from "../src/network.js";

describe("Network Coverage", () => {
  it("should return base chain for Network.Base", () => {
    const chain = getChainForNetwork(Network.Base);
    expect(chain.id).toBe(base.id);
  });

  it("should return baseSepolia for Network.BaseSepolia", () => {
    const chain = getChainForNetwork(Network.BaseSepolia as Network);
    expect(chain.id).toBe(baseSepolia.id);
  });

  it("should return baseSepolia for Network.Hardhat", () => {
    const chain = getChainForNetwork(Network.Hardhat as Network);
    expect(chain.id).toBe(hardhat.id);
  });

  it("should return baseSepolia for default case", () => {
    const chain = getChainForNetwork("invalid" as Network);
    expect(chain.id).toBe(baseSepolia.id);
  });
});
