import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
} from "viem";
import { creditABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { InsufficientFunds, InvalidValue, UnhandledCreditError } from "./errors.js";
import { DeepMutable, parseEventFromTransaction, type WriteResult } from "./utils.js";

// TODO: emulates `@wagmi/cli` generated constants
export const creditManagerAddress = {
  2938118273996536: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C", // TODO: testnet; outdated contract deployment, but keeping here
  4362550583360910: "0xa7B987f505366630109De019862c183E690a040B", // TODO: localnet; we need to make this deterministic
} as const;

// Used for getBalance()
export type CreditBalance = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getCreditBalance">
>;

// Used for getAccount()
export type CreditAccount = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getAccount">
>;

export type CreditApproval = Pick<CreditAccount, "approvals">;

// Used for getCreditStats()
export type CreditStats = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getCreditStats">
>;

// Used for getStorageStats()
export type StorageStats = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getStorageStats">
>;

// Used for getStorageUsage()
export type StorageUsage = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getStorageUsage">
>;

// Used for getSubnetStats()
export type SubnetStats = DeepMutable<
  ContractFunctionReturnType<typeof creditABI, AbiStateMutability, "getSubnetStats">
>;

// Used for approve()
export type ApproveResult = Required<
  GetEventArgs<typeof creditABI, "ApproveCredit", { IndexedOnly: false }>
>;

// Used for buyCredit()
export type BuyResult = Required<
  GetEventArgs<typeof creditABI, "BuyCredit", { IndexedOnly: false }>
>;

// Used for revokeCredit()
export type RevokeResult = Required<
  GetEventArgs<typeof creditABI, "RevokeCredit", { IndexedOnly: false }>
>;

export class CreditManager {
  client: HokuClient;
  contract: GetContractReturnType<typeof creditABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const deployedCreditManagerAddress = (creditManagerAddress as Record<number, Address>)[
      client.publicClient?.chain?.id || 0
    ];
    this.contract = getContract({
      abi: creditABI,
      address: contractAddress || deployedCreditManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<typeof creditABI, Client, Address> {
    return this.contract;
  }

  // Buy credits
  async buy(amount: bigint, recipient?: Address): Promise<WriteResult<BuyResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for buying credits");
    }
    const balance = await this.client.publicClient.getBalance({
      address: this.client.walletClient.account.address,
    });
    if (balance < amount) {
      throw new InsufficientFunds(amount);
    }
    try {
      const recipientAddress = recipient || this.client.walletClient.account.address;
      const args = [recipientAddress] as const;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "buyCredit",
        args,
        value: amount,
        account: this.client.walletClient.account,
      });
      const tx = await this.client.walletClient.writeContract(request);
      const result = await parseEventFromTransaction<BuyResult>(
        this.client.publicClient,
        this.contract.abi,
        "BuyCredit",
        tx
      );
      return { tx, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        // Although we make this check above, it's possible multiple buy requests are sent in the same block
        if (error.message.includes("insufficient funds")) {
          throw new InsufficientFunds(amount);
        }
      }
      throw new UnhandledCreditError(`Failed to buy credits: ${error}`);
    }
  }

  // Approve credit spending
  async approve(
    receiver: Address,
    requiredCaller: Address = receiver,
    limit: bigint = 0n,
    ttl: bigint = 0n,
    from?: Address
  ): Promise<WriteResult<ApproveResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving credits");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [fromAddress, receiver, requiredCaller, limit, ttl] as const;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "approveCredit",
        args,
        account: this.client.walletClient.account,
      });
      const tx = await this.client.walletClient.writeContract(request);
      const result = await parseEventFromTransaction<ApproveResult>(
        this.client.publicClient,
        this.contract.abi,
        "ApproveCredit",
        tx
      );
      return { tx, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `'from' address '${fromAddress}' does not match origin or caller '${this.client.walletClient.account.address}'`
          );
        }
      }
      throw new UnhandledCreditError(`Failed to approve credits: ${error}`);
    }
  }

  // Revoke credit approval
  async revoke(
    receiver: Address,
    requiredCaller: Address = receiver,
    from?: Address
  ): Promise<WriteResult<RevokeResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for revoking credits");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [fromAddress, receiver, requiredCaller] as const;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "revokeCredit",
        args,
        account: this.client.walletClient.account,
      });
      const tx = await this.client.walletClient.writeContract(request);
      const result = await parseEventFromTransaction<RevokeResult>(
        this.client.publicClient,
        this.contract.abi,
        "RevokeCredit",
        tx
      );
      return { tx, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `'from' address '${fromAddress}' does not match origin or caller '${this.client.walletClient.account.address}'`
          );
        }
      }
      throw new UnhandledCreditError(`Failed to revoke credits: ${error}`);
    }
  }

  // Get credit balance
  async getBalance(address: Address, blockNumber?: bigint): Promise<CreditBalance> {
    try {
      const balance = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getCreditBalance",
        args: [address],
        blockNumber,
      });
      return balance;
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get credit balance: ${error}`);
    }
  }

  // Get account details including approvals
  async getAccount(address: Address, blockNumber?: bigint): Promise<CreditAccount> {
    try {
      const account = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getAccount",
        args: [address],
        blockNumber,
      });
      // Since our `approvals` and `approval` are not read-only, we need to make them mutable
      return {
        ...account,
        approvals: account.approvals.map((approval) => ({
          ...approval,
          approval: approval.approval.map((approval) => ({ ...approval })),
        })),
      };
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get account details: ${error}`);
    }
  }

  // Get credit approvals
  async getCreditApprovals(
    sponsor: Address,
    receiver?: Address,
    requiredCaller?: Address,
    blockNumber?: bigint
  ): Promise<CreditApproval> {
    const account = await this.getAccount(sponsor, blockNumber);
    // Filter approvals by receiver and requiredCaller, if provided
    const approvals = account.approvals
      .filter((approval) => !receiver || approval.receiver === receiver)
      .filter(
        (approval) =>
          !requiredCaller ||
          approval.approval.some(({ requiredCaller: rc }) => rc === requiredCaller)
      );
    return { approvals };
  }

  // Get storage usage
  async getStorageUsage(address?: Address, blockNumber?: bigint): Promise<StorageUsage> {
    const addressArg = address || this.client.walletClient?.account?.address;
    if (!addressArg) {
      throw new Error("Address is required for getting storage usage");
    }
    try {
      return await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageUsage",
        args: [addressArg],
        blockNumber,
      });
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get storage usage: ${error}`);
    }
  }

  // Get credit stats
  async getCreditStats(blockNumber?: bigint): Promise<CreditStats> {
    try {
      return await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getCreditStats",
        blockNumber,
      });
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get credit stats: ${error}`);
    }
  }

  // Get storage stats
  async getStorageStats(blockNumber?: bigint): Promise<StorageStats> {
    try {
      return await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageStats",
        blockNumber,
      });
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get storage stats: ${error}`);
    }
  }

  // Get subnet stats
  async getSubnetStats(blockNumber?: bigint): Promise<SubnetStats> {
    try {
      return await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getSubnetStats",
        blockNumber,
      });
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get subnet stats: ${error}`);
    }
  }
}
