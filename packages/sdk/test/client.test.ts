import { strictEqual } from "assert";
import { describe, it } from "mocha";
import { localnet, testnet } from "../src/chains.js";
import {
  createPublicClientForChain,
  HokuClient,
  type HokuConfig,
  walletClientFromPrivateKey,
} from "../src/client.js";
import { Network } from "../src/network.js";

describe("client", function () {
  it("should get client with empty config", () => {
    const client = new HokuClient();
    strictEqual(client.publicClient.chain.id, testnet.id);
  });

  it("should get client from wallet", () => {
    const walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      localnet
    );
    const client = new HokuClient({ walletClient });
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from public client", () => {
    const publicClient = createPublicClientForChain(localnet);
    const client = new HokuClient({ publicClient });
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from chain name", () => {
    const client = HokuClient.fromChainName("localnet");
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from chain", () => {
    const client = HokuClient.fromChain(localnet);
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get client from config", () => {
    const config: HokuConfig = {
      publicClient: createPublicClientForChain(localnet),
      walletClient: walletClientFromPrivateKey(
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
        localnet
      ),
      network: Network.fromChain(localnet),
    };
    const client = new HokuClient(config);
    strictEqual(client.publicClient.chain.id, localnet.id);
  });
});
