import SafeApiKit from "@safe-global/api-kit";
import Safe from "@safe-global/protocol-kit";
import { MetaTransactionData, OperationType } from "@safe-global/types-kit";
import { encodeFunctionData, getAddress } from "viem";
import { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { abi } from "./abi.js";
import { Network, getChainForNetwork } from "./network.js";
import { AllocationResult, RewardsAllocator } from "./rewards-allocator.js";

/**
 * Configuration for the Safe transaction proposer
 * @param safeAddress The address of the Safe
 * @param rpcUrl The URL of the RPC provider
 * @param apiKey The API key for the Safe
 * @param chainId The chain ID
 * @param proposerPrivateKey The private key of the proposer
 */
export interface SafeTransactionProposerConfig {
  safeAddress: Hex;
  rpcUrl: string;
  apiKey: string;
  network: Network;
  proposerPrivateKey: Hex;
  tokenAddress: Hex;
  contractAddress: Hex;
}

/**
 * A class for proposing transactions to the Safe
 * @param config The configuration for the Safe transaction proposer
 */
export class SafeTransactionProposer implements RewardsAllocator {
  private safeAddress: Hex;
  private rpcUrl: string;
  private apiKey: string;
  private chainId: bigint;
  private proposerAddress: string;
  private proposerPrivateKey: string;
  private safeSdk: Safe | null = null;
  private tokenAddress: Hex;
  private contractAddress: Hex;

  constructor(config: SafeTransactionProposerConfig) {
    this.safeAddress = config.safeAddress;
    this.rpcUrl = config.rpcUrl;
    this.apiKey = config.apiKey;
    this.chainId = BigInt(getChainForNetwork(config.network).id);
    this.tokenAddress = config.tokenAddress;
    this.contractAddress = config.contractAddress;

    const account = privateKeyToAccount(config.proposerPrivateKey);
    this.proposerAddress = account.address;
    this.proposerPrivateKey = config.proposerPrivateKey;
  }

  async initializeSafe(): Promise<void> {
    this.safeSdk = await Safe.init({
      provider: this.rpcUrl,
      signer: this.proposerPrivateKey,
      safeAddress: this.safeAddress,
    });
  }

  /**
   * Proposes a transaction to the Safe
   * @param to The address of the recipient
   * @param value The value to send
   * @param data The data to send
   * @returns The Safe transaction
   */
  async allocate(
    root: string,
    allocatedAmount: bigint,
    startTimestamp: number,
  ): Promise<AllocationResult> {
    if (!this.safeSdk) {
      await this.initializeSafe();
    }

    const data = encodeFunctionData({
      abi,
      functionName: "addAllocation",
      args: [
        root as `0x${string}`,
        this.tokenAddress,
        allocatedAmount,
        BigInt(startTimestamp),
      ],
    });

    const transactionData: MetaTransactionData = {
      to: this.contractAddress,
      value: "0",
      data,
      operation: OperationType.Call,
    };

    const safeTransaction = await this.safeSdk!.createTransaction({
      transactions: [transactionData],
    });

    const safeTxHash = await this.safeSdk!.getTransactionHash(safeTransaction);
    const signature = await this.safeSdk!.signHash(safeTxHash);

    const apiKit = new SafeApiKit({
      chainId: this.chainId,
      apiKey: this.apiKey,
    });

    await apiKit.proposeTransaction({
      safeAddress: this.safeAddress,
      safeTransactionData: {
        to: getAddress(safeTransaction.data.to),
        value: safeTransaction.data.value,
        data: safeTransaction.data.data,
        operation: safeTransaction.data.operation,
        safeTxGas: safeTransaction.data.safeTxGas,
        baseGas: safeTransaction.data.baseGas,
        gasPrice: safeTransaction.data.gasPrice,
        gasToken: "0x0000000000000000000000000000000000000000",
        refundReceiver: "0x0000000000000000000000000000000000000000",
        nonce: safeTransaction.data.nonce,
      },
      safeTxHash,
      senderAddress: this.proposerAddress,
      senderSignature: signature.data,
    });

    return {
      transactionHash: safeTxHash,
    };
  }
}
