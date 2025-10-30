import {
  type Hex,
  type PublicClient,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { abi } from "./abi.js";
import { Network, getChainForNetwork } from "./network.js";
import { AllocationResult, RewardsAllocator } from "./rewards-allocator.js";

interface Options {
  timeout?: number;
  retryCount?: number;
  pollingInterval?: number;
}

export class ExternallyOwnedAccountAllocator implements RewardsAllocator {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private contractAddress: Hex;
  private timeout?: number;
  private tokenAddress: Hex;

  constructor(
    privateKey: Hex,
    rpcProviderUrl: string,
    contractAddress: Hex,
    tokenAddress: Hex,
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
    this.tokenAddress = tokenAddress;
  }

  async allocate(
    root: string,
    totalAmount: bigint,
    startTimestamp: number,
  ): Promise<AllocationResult> {
    const hash = await this.walletClient.writeContract({
      account: this.walletClient.account!,
      address: this.contractAddress,
      abi: abi,
      functionName: "addAllocation",
      args: [
        root as `0x${string}`,
        this.tokenAddress as `0x${string}`,
        totalAmount,
        BigInt(startTimestamp),
      ],
      chain: this.walletClient.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      timeout: this.timeout,
    });

    if (receipt.status !== "success") {
      throw new Error(
        "Transaction failed. Receipt: " + JSON.stringify(receipt),
      );
    }

    return {
      transactionHash: hash,
    };
  }
}
