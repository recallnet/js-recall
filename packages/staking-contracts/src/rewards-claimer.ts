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

class RewardsClaimer {
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

  /**
   * Claims rewards using a merkle proof
   * @param root The merkle root of the allocation
   * @param claimAmount The amount of tokens to claim
   * @param proof The merkle proof for the claim
   * @returns Promise<ClaimResult> The result of the claim transaction
   */
  async claim(
    root: string,
    claimAmount: bigint,
    proof: string[],
  ): Promise<ClaimResult> {
    const hash = await this.walletClient.writeContract({
      account: this.walletClient.account!,
      address: this.contractAddress,
      abi: abi,
      functionName: "claim",
      args: [root as `0x${string}`, claimAmount, proof as `0x${string}`[]],
      chain: this.walletClient.chain,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash,
      timeout: this.timeout,
    });

    if (receipt.status !== "success") {
      throw new Error(
        "Claim transaction failed. Receipt: " + JSON.stringify(receipt),
      );
    }

    return {
      transactionHash: hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
    };
  }

  /**
   * Gets the token balance for a specific account
   * @param tokenAddress The address of the ERC20 token
   * @param accountAddress The address of the account to check
   * @returns Promise<bigint> The token balance
   */
  async getBalance(
    tokenAddress: string,
    accountAddress: string,
  ): Promise<bigint> {
    const balance = await this.publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: [
        {
          inputs: [{ name: "account", type: "address" }],
          name: "balanceOf",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "balanceOf",
      args: [accountAddress as `0x${string}`],
    });

    return balance as bigint;
  }
}

export { Network };
export type { ClaimResult };
export default RewardsClaimer;
