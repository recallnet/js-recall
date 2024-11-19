// `Account` class wrapper around `GatewayManager`
import {
  AbiStateMutability,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  GetBalanceReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
} from "viem";
import { ierc20ABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { GatewayManager } from "../ipc/gateway.js";
import { InvalidValue } from "./errors.js";
import { parseEventFromTransaction, Result } from "./utils.js";

type AccountInfo = {
  address: Address;
  nonce: number;
  balance: bigint;
  parentBalance?: bigint;
};

type ApproveResult = Required<GetEventArgs<typeof ierc20ABI, "Approval", { IndexedOnly: false }>>;

type ApproveParams = ContractFunctionArgs<typeof ierc20ABI, AbiStateMutability, "approve">;

// TODO: emulates `@wagmi/cli` generated constants
export const supplySourceAddress = {
  3258443211374980: "0x20d8a696091153c4d4816ba1fdefe113f71e0905",
  4362550583360910: "0xa85233C63b9Ee964Add6F2cffe00Fd84eb32338f",
} as const;

export class AccountManager {
  client: HokuClient;
  gatewayManager: GatewayManager;

  constructor(client: HokuClient) {
    this.client = client;
    this.gatewayManager = new GatewayManager();
  }

  getGatewayManager(): GatewayManager {
    return this.gatewayManager;
  }

  async switchSubnet(
    from: Chain,
    to: Chain
  ): Promise<{ change: () => Promise<void>; reset: () => Promise<void> }> {
    return {
      change: async () => await this.client.switchChain(to),
      reset: async () => await this.client.switchChain(from),
    };
  }

  getSupplySource(
    client: HokuClient,
    address?: Address
  ): GetContractReturnType<typeof ierc20ABI, Client, Address> {
    const deployedSupplySourceAddress = (supplySourceAddress as Record<number, Address>)[
      client.publicClient?.chain?.id || 0
    ];
    return getContract({
      abi: ierc20ABI,
      address: address || deployedSupplySourceAddress,
      client: {
        public: this.client.publicClient,
        wallet: this.client.walletClient!,
      },
    });
  }

  async balance(address?: Address): Promise<Result<GetBalanceReturnType>> {
    const addr = address || this.client.walletClient?.account?.address;
    if (!addr) {
      throw new InvalidValue("Must provide an address or connect a wallet client");
    }
    return { result: await this.client.publicClient.getBalance({ address: addr }) };
  }

  async info(address?: Address): Promise<Result<AccountInfo>> {
    const addr = address || this.client.walletClient?.account?.address;
    if (!addr) {
      throw new InvalidValue("Must provide an address or connect a wallet client");
    }
    const balance = await this.balance(addr);
    const nonce = await this.client.publicClient.getTransactionCount({ address: addr });
    const currentChain = this.client.publicClient.chain;
    const parentChain = this.client.network.getParentChain();
    if (!parentChain) {
      return { result: { address: addr, nonce, balance: balance.result } };
    }
    const supplySourceAddress = this.getSupplySource(this.client).address;
    const { change, reset } = await this.switchSubnet(currentChain, parentChain);
    await change();
    const args = [addr] as const;
    const parentBalance = await this.getSupplySource(
      this.client,
      supplySourceAddress
    ).read.balanceOf(args);
    await reset();
    return { result: { address: addr, nonce, balance: balance.result, parentBalance } };
  }

  async approve(spender: Address, amount: bigint): Promise<Result<ApproveResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving");
    }
    const args = [spender, amount] as ApproveParams;
    const currentChain = this.client.publicClient.chain;
    const parentChain = this.client.network.getParentChain();
    if (!parentChain) {
      throw new InvalidValue("No parent chain found");
    }
    const supplySourceAddress = this.getSupplySource(this.client).address;
    const { change, reset } = await this.switchSubnet(currentChain, parentChain);
    await change();
    const supplySource = this.getSupplySource(this.client, supplySourceAddress);
    const { request } = await this.client.publicClient.simulateContract({
      address: supplySource.address,
      abi: supplySource.abi,
      functionName: "approve",
      args,
      account: this.client.walletClient.account,
    });
    const hash = await this.client.walletClient.writeContract(request);
    const {
      owner,
      spender: eventSpender,
      value,
    } = await parseEventFromTransaction<ApproveResult>(
      this.client.publicClient,
      supplySource.abi,
      "Approval",
      hash
    );
    const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
    await reset();
    return { meta: { tx }, result: { owner, spender: eventSpender, value } };
  }

  async deposit(amount: bigint, recipient?: Address): Promise<Result<boolean>> {
    const currentChain = this.client.publicClient.chain;
    const parentChain = this.client.network.getParentChain();
    if (!parentChain) {
      throw new InvalidValue("No parent chain found");
    }
    const { change, reset } = await this.switchSubnet(currentChain, parentChain);
    await change();
    const gatewayParentAddress = this.getGatewayManager().getContract(this.client).address;
    await reset();
    await this.approve(gatewayParentAddress, amount);
    await change();
    const gatewayAddress = this.getGatewayManager().getContract(this.client).address;
    const result = await this.gatewayManager.fundWithToken(
      this.client,
      amount,
      recipient,
      gatewayAddress
    );
    await reset();
    return result;
  }

  async withdraw(amount: bigint, recipient?: Address): Promise<Result<boolean>> {
    const result = await this.gatewayManager.release(this.client, amount, recipient);
    return result;
  }

  async transfer(recipient: Address, amount: bigint): Promise<Result<boolean>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for transfers");
    }
    const hash = await this.client.walletClient?.sendTransaction({
      account: this.client.walletClient.account,
      chain: this.client.walletClient.chain,
      to: recipient,
      value: amount,
    });
    const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
    return { meta: { tx }, result: true };
  }
}
