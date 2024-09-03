import {
  AddressLike,
  BigNumberish,
  ContractTransactionReceipt,
  TransactionReceipt,
} from "ethers";
import { EvmManager } from "./ipc/manager.js";
import { Wallet } from "./wallet.js";

export class Account {
  private readonly wallet: Wallet;

  constructor(wallet: Wallet) {
    this.wallet = wallet;
  }

  async balance(): Promise<BigNumberish> {
    return EvmManager.balance(
      await this.wallet.getAddress(),
      this.wallet.subnet
    );
  }

  async approveGateway(
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    return EvmManager.approveGateway(this.wallet, amount);
  }

  async deposit(
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    return EvmManager.deposit(this.wallet, amount);
  }

  async withdraw(): Promise<ContractTransactionReceipt | null> {
    return EvmManager.withdraw(this.wallet);
  }

  async transfer(
    to: AddressLike,
    amount: BigNumberish
  ): Promise<TransactionReceipt | null> {
    return EvmManager.transfer(this.wallet, to, amount);
  }
}
