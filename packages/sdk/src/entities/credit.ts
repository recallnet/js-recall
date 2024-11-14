import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
} from "viem";
import { creditManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { InsufficientFunds, InvalidValue, UnhandledCreditError } from "./errors.js";
import { DeepMutable, parseEventFromTransaction, type Result } from "./utils.js";

// TODO: emulates `@wagmi/cli` generated constants
export const creditManagerAddress = {
  2938118273996536: "0x8c2e3e8ba0d6084786d60A6600e832E8df84846C", // TODO: testnet; outdated contract deployment, but keeping here
  4362550583360910: "0xA540de8faAE57Ae43d8506CffA75B746820CbDE9", // TODO: localnet; we need to make this deterministic
} as const;

// Used for getBalance()
export type CreditBalance = DeepMutable<
  ContractFunctionReturnType<typeof creditManagerABI, AbiStateMutability, "getCreditBalance">
>;

// Used for getAccount()
export type CreditAccount = DeepMutable<
  ContractFunctionReturnType<typeof creditManagerABI, AbiStateMutability, "getAccount">
>;

export type CreditApproval = Pick<CreditAccount, "approvals">;

// Used for getCreditStats()
export type CreditStats = DeepMutable<
  ContractFunctionReturnType<typeof creditManagerABI, AbiStateMutability, "getCreditStats">
>;

// Used for approve()
export type ApproveResult = Required<
  GetEventArgs<typeof creditManagerABI, "ApproveCredit", { IndexedOnly: false }>
>;

type ApproveCreditParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "approveCredit"
>;

// Used for revoke()
type RevokeCreditParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "revokeCredit"
>;

// Used for buyCredit()
type BuyCreditParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "buyCredit"
>;

// Used for getCreditBalance()
type GetCreditBalanceParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "getCreditBalance"
>;

// Used for getAccount()
type GetAccountParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "getAccount"
>;

// Used for buyCredit()
export type BuyResult = Required<
  GetEventArgs<typeof creditManagerABI, "BuyCredit", { IndexedOnly: false }>
>;

// Used for revokeCredit()
export type RevokeResult = Required<
  GetEventArgs<typeof creditManagerABI, "RevokeCredit", { IndexedOnly: false }>
>;

export class CreditManager {
  client: HokuClient;
  contract: GetContractReturnType<typeof creditManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const deployedCreditManagerAddress = (creditManagerAddress as Record<number, Address>)[
      client.publicClient?.chain?.id || 0
    ];
    this.contract = getContract({
      abi: creditManagerABI,
      address: contractAddress || deployedCreditManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<typeof creditManagerABI, Client, Address> {
    return this.contract;
  }

  // Buy credits
  async buy(amount: bigint, recipient?: Address): Promise<Result<BuyResult>> {
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
      const args = [recipientAddress] satisfies BuyCreditParams;
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
      return { meta: { tx }, result };
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
  ): Promise<Result<ApproveResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving credits");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [
        fromAddress,
        receiver,
        requiredCaller,
        limit,
        ttl,
      ] satisfies ApproveCreditParams;
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
      return { meta: { tx }, result };
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
  ): Promise<Result<RevokeResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for revoking credits");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [fromAddress, receiver, requiredCaller] satisfies RevokeCreditParams;
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
      return { meta: { tx }, result };
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
  async getBalance(address?: Address, blockNumber?: bigint): Promise<Result<CreditBalance>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress) throw new InvalidValue("Must provide an address or connect a wallet client");
      const args = [forAddress] satisfies GetCreditBalanceParams;
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getCreditBalance",
        args,
        blockNumber,
      });
      return { result };
    } catch (error) {
      if (error instanceof InvalidValue) {
        throw error;
      }
      throw new UnhandledCreditError(`Failed to get credit balance: ${error}`);
    }
  }

  // Get account details including approvals
  async getAccount(address?: Address, blockNumber?: bigint): Promise<Result<CreditAccount>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress) throw new InvalidValue("Must provide an address or connect a wallet client");
      const args = [forAddress] satisfies GetAccountParams;
      const account = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getAccount",
        args,
        blockNumber,
      });
      // Since our `approvals` and `approval` are not read-only, we need to make them mutable
      return {
        result: {
          ...account,
          approvals: account.approvals.map((approval) => ({
            ...approval,
            approval: approval.approval.map((approval) => ({ ...approval })),
          })),
        },
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
  ): Promise<Result<CreditApproval>> {
    const {
      result: { approvals },
    } = await this.getAccount(sponsor, blockNumber);
    // Filter approvals by `receiver` and `requiredCaller`, if provided
    const filteredApprovals = approvals
      .filter((approval) => !receiver || approval.receiver === receiver)
      .filter(
        (approval) =>
          !requiredCaller ||
          approval.approval.some(({ requiredCaller: rc }) => rc === requiredCaller)
      );
    return { result: { approvals: filteredApprovals } };
  }

  // Get credit stats
  async getCreditStats(blockNumber?: bigint): Promise<Result<CreditStats>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getCreditStats",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledCreditError(`Failed to get credit stats: ${error}`);
    }
  }
}
