import { createPublicClient, createWalletClient, http, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';

import * as fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const abi = JSON.parse(
  fs.readFileSync(join(__dirname, '../contracts/abi/RewardAllocation.json'), 'utf8')
);

enum Network {
  BaseSepolia = 'baseSepolia',
  Base = 'base',
}

interface AllocationResult {
  transactionHash: string;
  blockNumber: bigint;
  gasUsed: bigint;
}

class RewardsAllocator {
  private walletClient: any;
  private publicClient: any;
  private contractAddress: string;

  constructor(
    privateKey: Hex,
    rpcProviderUrl: string,
    contractAddress: Hex,
    network: Network = Network.BaseSepolia
  ) {
    const account = privateKeyToAccount(privateKey);

    let chain;
    switch (network) {
      case Network.Base:
        chain = base;
        break;
      case Network.BaseSepolia:
      default:
        chain = baseSepolia;
        break;
    }

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcProviderUrl),
    });

    this.walletClient = createWalletClient({
      account,
      chain,
      transport: http(rpcProviderUrl),
    });

    this.contractAddress = contractAddress;
  }

  async allocate(
    root: string,
    tokenAddress: string,
    totalAmount: bigint,
    startTimestamp: number
  ): Promise<AllocationResult> {
    try {
      const { request } = await this.publicClient.simulateContract({
        account: this.walletClient.account,
        address: this.contractAddress,
        abi: abi,
        functionName: 'addAllocation',
        args: [root, tokenAddress, totalAmount, startTimestamp],
      });

      const hash = await this.walletClient.writeContract(request);

      const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        return {
          transactionHash: hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed,
        };
      }

      // #TODO: better error handling
      throw new Error('Transaction failed');
    } catch (error) {
      throw error;
    }
  }
}

export { Network };
export default RewardsAllocator;
