import * as fs from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import {
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { Network, getChainForNetwork } from "./network.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const abi = JSON.parse(
  fs.readFileSync(
    join(__dirname, "../contracts/abi/RewardAllocation.json"),
    "utf8",
  ),
);

interface AllocationResult {
  transactionHash: string;
  blockNumber: bigint;
  gasUsed: bigint;
}

interface ClaimResult {
  transactionHash: string;
  blockNumber: bigint;
  gasUsed: bigint;
}

interface Options {
  timeout?: number;
  retryCount?: number;
  pollingInterval?: number;
}

class RewardsAllocator {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private contractAddress: Hex;
  private timeout?: number;

  constructor(
    privateKey: Hex,
    rpcProviderUrl: string,
    contractAddress: Hex,
    network: Network = Network.BaseSepolia,
    options?: Options,
  ) {
    const account = privateKeyToAccount(privateKey);

    const chain = getChainForNetwork(network);

    const httpTransportOptions = options
      ? {
          timeout: options.timeout,
          retryCount: options.retryCount,
        }
      : undefined;

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcProviderUrl, httpTransportOptions),
      pollingInterval: options?.pollingInterval,
    });

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcProviderUrl, httpTransportOptions),
      pollingInterval: options?.pollingInterval,
    });

    this.contractAddress = contractAddress;
    this.timeout = options?.timeout;
  }

  async allocate(
    root: string,
    tokenAddress: string,
    totalAmount: bigint,
    startTimestamp: number,
  ): Promise<AllocationResult> {
    const hash = await this.walletClient.writeContract({
      account: this.walletClient.account!,
      address: this.contractAddress,
      abi: abi,
      functionName: "addAllocation",
      args: [root, tokenAddress, totalAmount, startTimestamp],
      chain: this.walletClient.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      timeout: this.timeout,
    });

    if (receipt.status === "success") {
      return {
        transactionHash: hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
      };
    }

    /* c8 ignore next */
    throw new Error("Transaction failed. Receipt: " + JSON.stringify(receipt));
  }
}

export { Network };
export type { AllocationResult, ClaimResult };
export default RewardsAllocator;
