import {
  AddressLike,
  BigNumberish,
  Contract,
  ContractTransactionReceipt,
  Network as EthersNetwork,
  JsonRpcProvider,
  Signer,
  TransactionReceipt,
} from "ethers";
import { EvmSubnet } from "../network.js";
import {
  ethAddressToFvmAddressStruct,
  GatewayManagerFacet,
  GatewayManagerFacetFactory,
} from "./contracts.js";

const ierc20Abi = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export function getGateway(
  signer: Signer,
  subnet: EvmSubnet
): GatewayManagerFacet {
  if (!signer.provider) {
    throw new Error("signer does not have a provider");
  }
  return GatewayManagerFacetFactory.connect(
    subnet.gatewayAddr,
    signer.provider
  );
}

function getEthProvider(subnet: EvmSubnet): JsonRpcProvider {
  const providerUrl = subnet.providerHttp;
  // const providerAuth = subnet.providerAuth;
  const subnetId = subnet.id;
  if (subnetId === null) {
    throw new Error("subnet ID is null");
  }
  const chainId = subnetId.chainId();
  const ethersNetwork = new EthersNetwork("hoku", chainId);
  const provider = new JsonRpcProvider(providerUrl, ethersNetwork);
  return provider;
}

function getSupplySource(signer: Signer, subnet: EvmSubnet): Contract {
  const address = subnet.supplySource;
  if (!address) {
    throw new Error("supply source is not configured for parent subnet");
  }
  return new Contract(address, ierc20Abi, signer);
}

// EVM RPC client for interacting with the IPC contracts.
export class EvmManager {
  // TODO: this presumes the balance is in the native coin, not supply source
  // tokens (which are ERC20s)
  static async balance(
    address: string,
    subnet: EvmSubnet
  ): Promise<BigNumberish> {
    const provider = getEthProvider(subnet);
    return provider.getBalance(address);
  }

  // TODO: this might not work becauase it sends a raw transaction.
  // The error below says the chain ID is invalid, but the chain ID is correct.
  // Error: could not coalesce error (error={ "code": 1, "message": "failed to
  // convert to unsigned msg: invalid chain id: 1717203960113192" }, payload={
  // "id": 7, "jsonrpc": "2.0", "method": "eth_sendRawTransaction", "params": [
  // "0x02f8b5870619c9b40ca8285983030c3683030cfe83ee78f494d4e09e3eef4f5d177e130f22d5bad25e5028f12580b844095ea7b3000000000000000000000000141ef571fd6c9e7f51faf697f4796a557c6bb6630000000000000000000000000000000000000000000000000000000000000001c001a04ebc0d1907edeba56b7665fc1df374f64b3111d8e2c92c3b8cb2c4c3926a6e44a009ec439a5c2ffef790c831991f0b8888cddbeabb623359b0ef82cc153ac02f86"
  // ] }, code=UNKNOWN_ERROR, version=6.13.2)
  static async approveGateway(
    signer: Signer,
    subnet: EvmSubnet,
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    const provider = getEthProvider(subnet);
    const connected = signer.connect(provider);
    const gateway = getGateway(connected, subnet);
    const supplySource = getSupplySource(connected, subnet);
    const tx = await supplySource.approve(await gateway.getAddress(), amount);
    const rec = await tx.wait();
    return rec;
  }

  // TODO: the onchain transaction takes an FvmAddress, which supposedly does
  // not support delegated addresses. how can we convert from an eth address to
  // a t1/f1 address type?
  // See: https://github.com/hokunet/ipc/blob/02b33d697d921d887267381c63e987a6ed4f7612/contracts/src/structs/FvmAddress.sol#L9
  static async deposit(
    signer: Signer,
    subnet: EvmSubnet,
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    const provider = getEthProvider(subnet);
    const connected = signer.connect(provider);
    const gateway = getGateway(connected, subnet);
    const subnetId = subnet.id;
    if (subnetId === null) {
      throw new Error("subnet ID is null");
    }
    const to = ethAddressToFvmAddressStruct(await connected.getAddress());
    const tx = await gateway.fundWithToken(subnetId.real, to, amount);
    const rec = await tx.wait();
    return rec;
  }

  // TODO: this might not work because it sends a raw transaction.
  static async withdraw(
    signer: Signer,
    subnet: EvmSubnet
  ): Promise<ContractTransactionReceipt | null> {
    const provider = getEthProvider(subnet);
    const connected = signer.connect(provider);
    const gateway = getGateway(connected, subnet);
    const to = ethAddressToFvmAddressStruct(await connected.getAddress());
    const tx = await gateway.release(to);
    const rec = await tx.wait();
    return rec;
  }

  static async transfer(
    signer: Signer,
    subnet: EvmSubnet,
    to: AddressLike,
    amount: BigNumberish
  ): Promise<TransactionReceipt | null> {
    const provider = getEthProvider(subnet);
    const connected = signer.connect(provider);
    const tx = await connected.sendTransaction({ to, value: amount });
    const rec = await tx.wait();
    return rec;
  }
}
