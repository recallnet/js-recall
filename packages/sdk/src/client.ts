import { Address, Chain, createPublicClient, http, PublicClient, WalletClient } from "viem";
import { type ChainName, getChain, localnet } from "./chains.js";
import { BucketManager, CreditManager } from "./entities/index.js";

// export const publicClient: PublicClient = createPublicClient({
//   chain: localnet as Chain,
//   transport: http(),
// });

// export const browserClient = () => {
//   const noopProvider = { request: () => null } as unknown as EIP1193Provider;
//   const provider = typeof window !== "undefined" ? window.ethereum! : noopProvider;
//   return createWalletClient({
//     chain: localnet as Chain,
//     transport: custom(provider),
//   });
// };

// export const walletClient: (privateKey: Hex) => WalletClient = (privateKey: Hex) =>
//   createWalletClient({
//     account: privateKeyToAccount(privateKey),
//     chain: localnet as Chain,
//     transport: http(),
//   });

export class HokuClient {
  public publicClient: PublicClient;
  public walletClient: WalletClient | undefined;

  constructor({
    publicClient,
    walletClient,
  }: {
    publicClient?: PublicClient;
    walletClient?: WalletClient | undefined;
  } = {}) {
    if (walletClient) this.walletClient = walletClient;
    if (publicClient) {
      this.publicClient = publicClient;
    } else {
      this.publicClient = walletClient
        ? HokuClient.fromChain(walletClient.chain).publicClient
        : HokuClient.fromChain().publicClient;
    }
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

  bucketManager(contractAddress?: Address): BucketManager {
    return new BucketManager(this, contractAddress);
  }

  creditManager(contractAddress?: Address): CreditManager {
    return new CreditManager(this, contractAddress);
  }
}
