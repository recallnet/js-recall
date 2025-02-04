import { describe, it } from "mocha";
import { strictEqual } from "node:assert";

import { localnet, testnet } from "../src/chains.js";
import {
  RecallClient,
  type RecallConfig,
  createPublicClientForChain,
  walletClientFromPrivateKey,
} from "../src/client.js";
import { Network } from "../src/network.js";

describe("client", function () {
  it("should get client with empty config", () => {
    const client = new RecallClient();
    strictEqual(client.publicClient.chain.id, testnet.id);
  });

  it("should get client from wallet", () => {
    const walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      localnet,
    );
    const client = new RecallClient({ walletClient });
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from public client", () => {
    const publicClient = createPublicClientForChain(localnet);
    const client = new RecallClient({ publicClient });
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from chain name", () => {
    const client = RecallClient.fromChainName("localnet");
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from chain", () => {
    const client = RecallClient.fromChain(localnet);
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from config", () => {
    const config: RecallConfig = {
      publicClient: createPublicClientForChain(localnet),
      walletClient: walletClientFromPrivateKey(
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        localnet,
      ),
      network: Network.fromChain(localnet),
    };
    const client = new RecallClient(config);
    strictEqual(client.publicClient.chain.id, localnet.id);
  });
});
