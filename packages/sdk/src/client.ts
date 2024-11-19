import {
  Account,
  Address,
  Chain,
  createPublicClient,
  createWalletClient,
  custom,
  EIP1193Provider,
  Hex,
  http,
  PublicClient,
  Transport,
  WalletClient,
} from "viem";
import "viem/window";
import { privateKeyToAccount } from "viem/accounts";
import { type ChainName, getChain, localnet } from "./chains.js";
import { AccountManager, BlobManager, BucketManager, CreditManager } from "./entities/index.js";
import { Network } from "./network.js";

export const createPublicClientForChain: (chain: Chain) => PublicClient<Transport, Chain> = (
  chain: Chain
) =>
  createPublicClient({
    chain,
    transport: http(),
  });

export const walletClientFromBrowser = (chain: Chain): WalletClient => {
  const noopProvider = { request: () => null } as unknown as EIP1193Provider;
  const provider = typeof window !== "undefined" ? window.ethereum! : noopProvider;
  return createWalletClient({
    chain,
    transport: custom(provider),
  });
};

export const walletClientFromPrivateKey = (
  privateKey: Hex,
  chain: Chain
): WalletClient<Transport, Chain, Account> => {
  return createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain,
    transport: http(),
  });
};

export type HokuConfig = {
  publicClient?: PublicClient<Transport, Chain>;
  walletClient?: WalletClient<Transport, Chain>;
  network?: Network;
};

export class HokuClient {
  public publicClient: PublicClient<Transport, Chain>;
  public walletClient: WalletClient | undefined;
  public network: Network;

  constructor(config: HokuConfig = {}) {
    if (config.walletClient) this.walletClient = config.walletClient;
    if (config.publicClient) {
      this.publicClient = config.publicClient;
    } else {
      this.publicClient = config.walletClient
        ? HokuClient.fromChain(config.walletClient.chain).publicClient
        : HokuClient.fromChain().publicClient;
    }
    const chain = this.publicClient.chain;
    if (!chain) throw new Error("missing chain in provided client");
    this.network = config.network ?? Network.fromChain(chain);
  }

  static fromChain(chain: Chain = localnet) {
    return new HokuClient({
      publicClient: createPublicClient({ chain, transport: http() }),
    });
  }

  static fromChainName(chainName: ChainName = "localnet") {
    return new HokuClient({
      publicClient: createPublicClient({
        chain: getChain(chainName),
        transport: http(),
      }),
    });
  }

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

  accountManager(): AccountManager {
    return new AccountManager(this);
  }

  blobManager(contractAddress?: Address): BlobManager {
    return new BlobManager(this, contractAddress);
  }

  bucketManager(contractAddress?: Address): BucketManager {
    return new BucketManager(this, contractAddress);
  }

  creditManager(contractAddress?: Address): CreditManager {
    return new CreditManager(this, contractAddress);
  }
}
