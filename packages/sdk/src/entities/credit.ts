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
  zeroAddress,
} from "viem";
import { creditManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { creditManagerAddress } from "../constants.js";
import {
  ActorNotFound,
  InsufficientFunds,
  InvalidValue,
  isActorNotFoundError,
  UnhandledCreditError,
} from "./errors.js";
import { parseEventFromTransaction, type Result } from "./utils.js";

// Used for getBalance()
export type CreditBalance = ContractFunctionReturnType<
  typeof creditManagerABI,
  AbiStateMutability,
  "getCreditBalance"
>;

// Used for getAccount()
export type CreditAccount = ContractFunctionReturnType<
  typeof creditManagerABI,
  AbiStateMutability,
  "getAccount"
>;

export type CreditApproval = Pick<CreditAccount, "approvals">;

// Used for getCreditStats()
export type CreditStats = ContractFunctionReturnType<
  typeof creditManagerABI,
  AbiStateMutability,
  "getCreditStats"
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

// Used for setAccountSponsor()
export type SetAccountSponsorParams = ContractFunctionArgs<
  typeof creditManagerABI,
  AbiStateMutability,
  "setAccountSponsor"
>;

// Used for setAccountSponsor()
export type SetAccountSponsorResult = Required<
  GetEventArgs<typeof creditManagerABI, "SetAccountSponsor", { IndexedOnly: false }>
>;

// Credit manager for buy, approving, revoking, and general credit operations
export class CreditManager {
  client: HokuClient;
  contract: GetContractReturnType<typeof creditManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedCreditManagerAddress = (creditManagerAddress as Record<number, Address>)[chainId];
    if (!deployedCreditManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
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

  // Approve credit spending
  // TODO: maybe make the input params an object for easier optional params
  async approve(
    to: Address,
    caller: Address[] = [],
    creditLimit: bigint = 0n,
    gasFeeLimit: bigint = 0n,
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
        to,
        caller,
        creditLimit,
        gasFeeLimit,
        ttl,
      ] satisfies ApproveCreditParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "approveCredit",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = await parseEventFromTransaction<ApproveResult>(
        this.client.publicClient,
        this.contract.abi,
        "ApproveCredit",
        hash
      );
      return { meta: { tx }, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `'from' address '${fromAddress}' does not match origin or caller '${this.client.walletClient.account.address}'`
          );
        }
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledCreditError(`Failed to approve credits: ${error}`);
    }
  }

  // Buy credits
  async buy(amount: bigint, to?: Address): Promise<Result<BuyResult>> {
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
      const toAddress = to || this.client.walletClient.account.address;
      const args = [toAddress] satisfies BuyCreditParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "buyCredit",
        args,
        value: amount,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = await parseEventFromTransaction<BuyResult>(
        this.client.publicClient,
        this.contract.abi,
        "BuyCredit",
        hash
      );
      return { meta: { tx }, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        // Although we make this check above, it's possible multiple buy requests are sent in the same block
        if (error.message.includes("insufficient funds")) {
          throw new InsufficientFunds(amount);
        }
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledCreditError(`Failed to buy credits: ${error}`);
    }
  }

  // Revoke credit approval
  async revoke(
    to: Address,
    requiredCaller: Address = to,
    from?: Address
  ): Promise<Result<RevokeResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for revoking credits");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [fromAddress, to, requiredCaller] satisfies RevokeCreditParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "revokeCredit",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = await parseEventFromTransaction<RevokeResult>(
        this.client.publicClient,
        this.contract.abi,
        "RevokeCredit",
        hash
      );
      return { meta: { tx }, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `'from' address '${fromAddress}' does not match origin or caller '${this.client.walletClient.account.address}'`
          );
        }
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledCreditError(`Failed to revoke credits: ${error}`);
    }
  }

  // Set account sponsor
  async setAccountSponsor(
    sponsor: Address,
    from?: Address
  ): Promise<Result<SetAccountSponsorResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for setting account sponsor");
    }
    const fromAddress = from || this.client.walletClient.account.address;
    try {
      const args = [fromAddress, sponsor] satisfies SetAccountSponsorParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "setAccountSponsor",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = await parseEventFromTransaction<SetAccountSponsorResult>(
        this.client.publicClient,
        this.contract.abi,
        "SetAccountSponsor",
        hash
      );
      return { meta: { tx }, result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledCreditError(`Failed to set account sponsor: ${error}`);
    }
  }

  // Get account details including approvals
  async getAccount(address?: Address, blockNumber?: bigint): Promise<Result<CreditAccount>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress) throw new InvalidValue("Must provide an address or connect a wallet client");
      const args = [forAddress] satisfies GetAccountParams;
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getAccount",
        args,
        blockNumber,
      });
      return { result };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound } = isActorNotFoundError(error);
        if (isActorNotFound) {
          const emptyAccount = {
            approvals: [],
            capacityUsed: 0n,
            creditFree: 0n,
            creditCommitted: 0n,
            creditSponsor: "0x0000000000000000000000000000000000000000",
            lastDebitEpoch: 0n,
            maxTtl: 0n,
            gasAllowance: 0n,
          } as CreditAccount;
          return { result: emptyAccount };
        }
      }
      throw new UnhandledCreditError(`Failed to get account details: ${error}`);
    }
  }

  // Get credit approvals
  async getCreditApprovals(
    from: Address,
    to?: Address,
    blockNumber?: bigint
  ): Promise<Result<CreditApproval>> {
    let {
      result: { approvals },
    } = await this.getAccount(from, blockNumber);
    // Filter approvals by `to`, if provided
    approvals = to ? approvals.filter((approval) => approval.to === to) : approvals;
    return { result: { approvals } };
  }

  // Get credit balance
  async getCreditBalance(address?: Address, blockNumber?: bigint): Promise<Result<CreditBalance>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress) throw new InvalidValue("Must provide an address or connect a wallet client");
      const args = [forAddress] satisfies GetCreditBalanceParams;
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getCreditBalance",
        args,
        blockNumber,
      })) as CreditBalance;
      return { result };
    } catch (error) {
      if (error instanceof InvalidValue) {
        throw error;
      }
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound } = isActorNotFoundError(error);
        if (isActorNotFound) {
          const emptyBalance = {
            creditFree: 0n,
            creditCommitted: 0n,
            creditSponsor: zeroAddress,
            lastDebitEpoch: 0n,
            approvals: [],
            gasAllowance: 0n,
          } as CreditBalance;
          return { result: emptyBalance };
        }
      }
      throw new UnhandledCreditError(`Failed to get credit balance: ${error}`);
    }
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
