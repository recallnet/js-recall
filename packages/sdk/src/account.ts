import {
  AddressLike,
  BigNumberish,
  ContractTransactionReceipt,
  Signer,
  TransactionReceipt,
} from "ethers";
import { EvmManager } from "./ipc/manager.js";
import { Network } from "./network.js";

export class Account {
  private signer: Signer;
  private readonly network: Network;

  constructor(network: Network, signer: Signer) {
    this.signer = signer;
    this.network = network;
  }

  async getSigner(): Promise<Signer> {
    return this.signer;
  }

  async balance(): Promise<BigNumberish> {
    return EvmManager.balance(
      await this.signer.getAddress(),
      this.network.subnetConfig()
    );
  }

  async approveGateway(
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    return EvmManager.approveGateway(
      this.signer,
      this.network.parentSubnetConfig(),
      amount
    );
  }

  async deposit(
    amount: BigNumberish
  ): Promise<ContractTransactionReceipt | null> {
    return EvmManager.deposit(
      this.signer,
      this.network.parentSubnetConfig(),
      amount
    );
  }

  async withdraw(): Promise<ContractTransactionReceipt | null> {
    return EvmManager.withdraw(this.signer, this.network.subnetConfig());
  }

  async transfer(
    to: AddressLike,
    amount: BigNumberish
  ): Promise<TransactionReceipt | null> {
    return EvmManager.transfer(
      this.signer,
      this.network.subnetConfig(),
      to,
      amount
    );
  }
}
