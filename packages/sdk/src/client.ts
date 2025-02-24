import {
  Account,
  Address,
  Chain,
  Hex,
  PublicClient,
  Transport,
  WalletClient,
  createPublicClient,
  createWalletClient,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "viem/window";

import { type ChainName, getChain, testnet } from "@recallnet/chains";

import { AccountManager } from "./entities/account.js";
import { BlobManager } from "./entities/blob.js";
import { BucketManager } from "./entities/bucket.js";
import { CreditManager } from "./entities/credit.js";
import { SubnetId } from "./ipc/subnet.js";

// Creates a public client for the given chain
export const createPublicClientForChain: (
  chain: Chain,
) => PublicClient<Transport, Chain> = (chain: Chain) =>
  createPublicClient({
    chain,
    transport: http(),
  });

// Creates a wallet client for the given chain with a private key
export const walletClientFromPrivateKey = (
  privateKey: Hex,
  chain: Chain,
): WalletClient<Transport, Chain, Account> => {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport: http(),
  });
};

// Map of chain ID to contract address
export type ContractConfig = Record<number, Address>;

// Contract overrides for a given chain
export type ContractOverrides = {
  bucketManager?: ContractConfig;
  blobManager?: ContractConfig;
  creditManager?: ContractConfig;
  accountManager?: {
    gatewayManager?: ContractConfig;
    recallErc20?: ContractConfig;
  };
};

// Configuration for the RecallClient
export interface RecallConfig {
  publicClient?: PublicClient<Transport, Chain>;
  walletClient?: WalletClient<Transport, Chain, Account>;
  contractOverrides?: ContractOverrides;
}

// The RecallClient class for interacting with subnet buckets, blobs, credits, and accounts
export class RecallClient {
  public publicClient: PublicClient<Transport, Chain>;
  public walletClient: WalletClient<Transport, Chain, Account> | undefined;
  public contractOverrides: ContractOverrides;
  public subnetId: SubnetId;

  // TODO: this logic probably needs to be refactored to properly handle conflicts
  constructor(config: RecallConfig = {}) {
    if (config.walletClient) this.walletClient = config.walletClient;
    if (config.publicClient) {
      this.publicClient = config.publicClient;
    } else {
      this.publicClient = config.walletClient
        ? RecallClient.fromChain(config.walletClient.chain).publicClient
        : RecallClient.fromChain().publicClient;
    }
    const chain = this.publicClient.chain;
    if (!chain) throw new Error("missing chain in provided client");
    this.subnetId = SubnetId.fromChain(chain);
    this.contractOverrides = config.contractOverrides ?? {};
  }

  // Creates a RecallClient from a chain
  static fromChain(chain: Chain = testnet) {
    return new RecallClient({
      publicClient: createPublicClient({ chain, transport: http() }),
    });
  }

  // Creates a RecallClient from a chain name
  static fromChainName(chainName: ChainName = "testnet") {
    return new RecallClient({
      publicClient: createPublicClient({
        chain: getChain(chainName),
        transport: http(),
      }),
    });
  }

  // Switches the chain for the client (e.g., from/to a parent and child subnet chain)
  async switchChain(chain: Chain): Promise<void> {
    this.publicClient = createPublicClientForChain(chain);
    if (!this.walletClient) return;

    // Check if it's a browser wallet (transport will be custom)
    const isBrowserWallet = this.walletClient.transport.type === "custom";

    if (isBrowserWallet) {
      await this.walletClient.switchChain({ id: chain.id });
    } else {
      // For private key wallets, recreate the client
      this.walletClient = createWalletClient({
        chain,
        account: this.walletClient.account,
        transport: http(),
      });
    }
  }

  // Returns the subnet ID for the client
  getSubnetId(): SubnetId {
    return this.subnetId;
  }

  // Creates an AccountManager for the client
  accountManager(): AccountManager {
    return new AccountManager(this);
  }

  // Creates a BlobManager for the client
  blobManager(contractAddress?: Address): BlobManager {
    const override =
      contractAddress ??
      this.contractOverrides.blobManager?.[this.publicClient.chain.id];
    return new BlobManager(this, override);
  }

  // Creates a BucketManager for the client
  bucketManager(contractAddress?: Address): BucketManager {
    const override =
      contractAddress ??
      this.contractOverrides.bucketManager?.[this.publicClient.chain.id];
    return new BucketManager(this, override);
  }

  // Creates a CreditManager for the client
  creditManager(contractAddress?: Address): CreditManager {
    const override =
      contractAddress ??
      this.contractOverrides.creditManager?.[this.publicClient.chain.id];
    return new CreditManager(this, override);
  }
}
