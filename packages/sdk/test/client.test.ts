import { describe, it } from "mocha";
import { strictEqual } from "node:assert";

import { getParentChain, localnet, testnet } from "@recallnet/chains";
import { TESTNET_SUBNET_ID } from "@recallnet/network-constants";

import {
  RecallClient,
  type RecallConfig,
  createPublicClientForChain,
  walletClientFromPrivateKey,
} from "../src/client.js";

describe("client", function () {
  it("should get client with empty config", () => {
    const client = new RecallClient();
    strictEqual(client.publicClient.chain.id, testnet.id);
  });

  it("should get client from wallet", () => {
    let walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      localnet,
    );
    let client = new RecallClient({ walletClient });
    strictEqual(client.publicClient.chain.id, localnet.id);

    walletClient = walletClientFromPrivateKey(
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
      testnet,
    );
    client = new RecallClient({ walletClient });
    strictEqual(client.publicClient.chain.id, testnet.id);
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
    };
    const client = new RecallClient(config);
    strictEqual(client.publicClient.chain.id, localnet.id);
  });

  it("should get subnet ID", () => {
    const client = new RecallClient();
    strictEqual(client.getSubnetId().toString(), TESTNET_SUBNET_ID);
  });

  it("should use contract overrides", () => {
    const client = new RecallClient({
      contractOverrides: {
        bucketManager: {
          [testnet.id]: "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
        },
        blobManager: {
          [testnet.id]: "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
        },
        creditManager: {
          [testnet.id]: "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
        },
        accountManager: {
          gatewayManager: {
            [testnet.id]: "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
          },
          recallErc20: {
            [getParentChain(testnet)!.id]:
              "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
          },
        },
      },
    });
    strictEqual(
      client.bucketManager().getContract().address,
      "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
    );
    strictEqual(
      client.blobManager().getContract().address,
      "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
    );
    strictEqual(
      client.creditManager().getContract().address,
      "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
    );
    strictEqual(
      client.accountManager().getSupplySource(getParentChain(testnet)!).address,
      "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
    );
    // strictEqual(
    //   client.accountManager().getGatewayManager().getContract(client).address,
    //   "0xB5B359EEc9549b0D65B3D1137EFDf51f09c65c5b",
    // );
  });
});
