import {
  BlockTag,
  Network as EthersNetwork,
  Wallet as EthersWallet,
  JsonRpcProvider,
  Provider,
  type Signer,
  TransactionLike,
  TransactionRequest,
  type TransactionResponse,
  TypedDataDomain,
  TypedDataField,
} from "ethers";
import { SubnetId } from "./ipc/subnet.js";
import { EvmSubnet } from "./network.js";

/**
 * Create a signer with a private key, a provider URL, and a chain. Optionally,
 * pass the chain name or ID to create a static network and reduce calls made by
 * the provider (by not checking the chain ID).
 * @param privateKey The private key of the signer.
 * @param network The network to connect to.
 */
function createSigner({
  privateKey,
  subnet,
}: {
  privateKey: string;
  subnet: EvmSubnet;
}): Signer {
  const wallet = new EthersWallet(privateKey);
  const providerUrl = subnet.providerHttp;
  const subnetId = subnet.id;
  if (subnetId === null) {
    throw new Error("subnet ID is null");
  }
  const chainId = subnetId.chainId();
  const ethersNetwork = new EthersNetwork("hoku", chainId);
  const provider = new JsonRpcProvider(providerUrl, ethersNetwork, {
    staticNetwork: true,
  });
  const signer = wallet.connect(provider);
  return signer;
}

export class Wallet implements Signer {
  private readonly subnetConfig: EvmSubnet;
  private readonly signer: Signer;

  constructor(privateKey: string, subnet: EvmSubnet) {
    this.subnetConfig = subnet;
    this.signer = createSigner({
      privateKey,
      subnet,
    });
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  connect(provider: Provider): Signer {
    throw new Error("wallet connection handled during initialization");
  }

  get provider(): Provider {
    return this.signer.provider as Provider;
  }

  get subnetId(): SubnetId | null {
    return this.subnetConfig?.id;
  }

  get subnet(): EvmSubnet {
    return this.subnetConfig;
  }

  getAddress(): Promise<string> {
    return this.signer.getAddress();
  }

  getNonce(blockTag?: BlockTag): Promise<number> {
    return this.signer.getNonce(blockTag);
  }

  populateCall(tx: TransactionRequest): Promise<TransactionLike<string>> {
    return this.signer.populateCall(tx);
  }

  populateTransaction(
    tx: TransactionRequest
  ): Promise<TransactionLike<string>> {
    return this.signer.populateTransaction(tx);
  }

  async estimateGas(tx: TransactionRequest): Promise<bigint> {
    return this.signer.estimateGas(tx);
  }

  async call(tx: TransactionRequest): Promise<string> {
    return this.signer.call(tx);
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  async resolveName(name: string): Promise<string | null> {
    throw new Error("ENS names are not supported");
  }

  async signTransaction(tx: TransactionRequest): Promise<string> {
    return this.signer.signTransaction(tx);
  }

  // Node: IPC doesn't support `eth_sendTransaction`, so this might have to be
  // implemented to use FVM messages or simply removed, for now
  async sendTransaction(tx: TransactionRequest): Promise<TransactionResponse> {
    return this.signer.sendTransaction(tx);
  }

  // TODO: test if signing EVM txs works
  async signMessage(message: string | Uint8Array): Promise<string> {
    return this.signer.signMessage(message);
  }

  // TODO: test if signing EVM typed data works
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, Array<TypedDataField>>,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    value: Record<string, any>
  ): Promise<string> {
    return this.signer.signTypedData(domain, types, value);
  }
}
