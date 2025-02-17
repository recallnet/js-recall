import {
  Account,
  Address,
  Chain,
  EIP1193Provider,
  Hex,
  PublicClient,
  Transport,
  WalletClient,
  createPublicClient,
  createWalletClient,
  custom,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import "viem/window";

import { type ChainName, getChain, testnet } from "@recallnet/chains";

import {
  AccountManager,
  BlobManager,
  BucketManager,
  CreditManager,
} from "./entities/index.js";
import { Network } from "./network.js";

// Creates a public client for the given chain
export const createPublicClientForChain: (
  chain: Chain,
) => PublicClient<Transport, Chain> = (chain: Chain) =>
  createPublicClient({
    chain,
    transport: http(),
  });

// Creates a wallet client for the given chain with a browser wallet provider
export const walletClientFromBrowser = (
  chain: Chain,
): WalletClient<Transport, Chain, Account> => {
  const noopProvider = { request: () => null } as unknown as EIP1193Provider;
  const provider =
    typeof window !== "undefined" ? window.ethereum! : noopProvider;
  return createWalletClient({
    chain,
    transport: custom(provider),
  });
};

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

// Configuration for the RecallClient
export interface RecallConfig {
  publicClient?: PublicClient<Transport, Chain>;
  walletClient?: WalletClient<Transport, Chain, Account>;
  network?: Network;
}

// The RecallClient class for interacting with subnet buckets, blobs, credits, and accounts
export class RecallClient {
  public publicClient: PublicClient<Transport, Chain>;
  public walletClient: WalletClient<Transport, Chain, Account> | undefined;
  public network: Network;

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
    this.network = config.network ?? Network.fromChain(chain);
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

  // Returns the network for the client
  getNetwork(): Network {
    return this.network;
  }

  // Creates an AccountManager for the client
  accountManager(): AccountManager {
    return new AccountManager(this);
  }

  // Creates a BlobManager for the client
  blobManager(contractAddress?: Address): BlobManager {
    return new BlobManager(this, contractAddress);
  }

  // Creates a BucketManager for the client
  bucketManager(contractAddress?: Address): BucketManager {
    return new BucketManager(this, contractAddress);
  }

  // Creates a CreditManager for the client
  creditManager(contractAddress?: Address): CreditManager {
    return new CreditManager(this, contractAddress);
  }
}
