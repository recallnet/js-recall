import {
  AbiStateMutability,
  Account,
  Address,
  Chain,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  GetContractReturnType,
  Hex,
  TransactionReceipt,
  getContract,
  zeroAddress,
} from "viem";

import {
  iBlobsFacadeAbi,
  iCreditFacadeAbi,
  iCreditFacadeAddress,
} from "@recallnet/contracts";

import { RecallClient } from "../client.js";
import {
  ActorNotFound,
  InsufficientFunds,
  InvalidValue,
  UnhandledCreditError,
  isActorNotFoundError,
} from "../errors.js";
import { type Result } from "../utils.js";

// Used for getAccount()
export type CreditAccount = ContractFunctionReturnType<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "getAccount"
>;

export type CreditApproval = Pick<
  CreditAccount,
  "approvalsTo" | "approvalsFrom"
>;

// Used for getCreditStats()
export type CreditStats = Pick<
  ContractFunctionReturnType<
    typeof iBlobsFacadeAbi,
    AbiStateMutability,
    "getStats"
  >,
  | "balance"
  | "creditSold"
  | "creditCommitted"
  | "creditDebited"
  | "tokenCreditRate"
  | "numAccounts"
>;

export type ApproveCreditParams = ContractFunctionArgs<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "approveCredit"
>;

export type ApproveCreditOptions = {
  creditLimit: bigint;
  gasFeeLimit: bigint;
  ttl: bigint;
};

// Used for revoke()
export type RevokeCreditParams = ContractFunctionArgs<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "revokeCredit"
>;

// Used for buyCredit()
export type BuyCreditParams = ContractFunctionArgs<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "buyCredit"
>;

// Used for getAccount()
export type GetAccountParams = ContractFunctionArgs<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "getAccount"
>;

// Used for setAccountSponsor()
export type SetAccountSponsorParams = ContractFunctionArgs<
  typeof iCreditFacadeAbi,
  AbiStateMutability,
  "setAccountSponsor"
>;

export type CreditBalance = Pick<
  CreditAccount,
  | "creditFree"
  | "creditCommitted"
  | "creditSponsor"
  | "lastDebitEpoch"
  | "approvalsTo"
  | "approvalsFrom"
  | "maxTtl"
  | "gasAllowance"
>;

// Credit manager for buy, approving, revoking, and general credit operations
export class CreditManager {
  client: RecallClient;
  contract: GetContractReturnType<typeof iCreditFacadeAbi, Client, Address>;

  constructor(client: RecallClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedCreditManagerAddress = (
      iCreditFacadeAddress as Record<number, Address>
    )[chainId];
    if (!deployedCreditManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}`);
    }
    this.contract = getContract({
      abi: iCreditFacadeAbi,
      address: contractAddress || deployedCreditManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<
    typeof iCreditFacadeAbi,
    Client,
    Address
  > {
    return this.contract;
  }

  // Approve credit spending
  // TODO: maybe make the input params an object for easier optional params
  async approve(to: Address, options?: ApproveCreditOptions): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for approving credits");
    }
    let hash: Hex;
    let tx: TransactionReceipt;
    try {
      // TODO: a few things:
      // 1. the facades don't allow you to pass a "null" `ttl` param, so we must make it
      // required and do so by requiring "all or none" of the options. else, if only `to` is given,
      // the FVM layer will handle null values internally.
      // 2. the `caller` param is deprecated in `ipc`, so this should be removed in the future.
      // 3. the overloaded type inference causes problems with the compiler, so our code here is
      // rather duplicative. e.g., if you assign `args` a value from a ternary, the compiler
      // will complain and won't let you coerce it to the right type.
      const gasPrice = await this.client.publicClient.getGasPrice();
      if (options === undefined) {
        const args = [to] satisfies ApproveCreditParams;
        const { request } = await this.contract.simulate.approveCredit<
          Chain,
          Account
        >(args, {
          account: this.client.walletClient.account,
          gasPrice,
        });
        hash = await this.client.walletClient.writeContract(request);
        tx = await this.client.publicClient.waitForTransactionReceipt({
          hash,
        });
      } else {
        const args = [
          to,
          [],
          options.creditLimit,
          options.gasFeeLimit,
          options.ttl,
        ] satisfies ApproveCreditParams;
        const { request } = await this.contract.simulate.approveCredit<
          Chain,
          Account
        >(args, {
          account: this.client.walletClient.account,
          gasPrice,
        });
        hash = await this.client.walletClient.writeContract(request);
        tx = await this.client.publicClient.waitForTransactionReceipt({
          hash,
        });
      }
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `address does not match origin or caller '${this.client.walletClient.account.address}'`,
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
  async buy(amount: bigint, to?: Address): Promise<Result> {
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
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.buyCredit<
        Chain,
        Account
      >(args, {
        value: amount,
        account: this.client.walletClient.account,
        gasPrice,
      });
      const hash = await this.contract.write.buyCredit(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
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
  async revoke(to: Address): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for revoking credits");
    }
    try {
      const args = [to] satisfies RevokeCreditParams; // TODO: remove once caller param is deprecated in `ipc`
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.revokeCredit<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.revokeCredit(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes("does not match origin or caller")) {
          throw new InvalidValue(
            `address does not match origin or caller '${this.client.walletClient.account.address}'`,
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
  async setAccountSponsor(sponsor: Address): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error(
        "Wallet client is not initialized for setting account sponsor",
      );
    }
    try {
      const args = [sponsor] satisfies SetAccountSponsorParams;
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.setAccountSponsor<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.setAccountSponsor(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
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
  async getAccount(
    address?: Address,
    blockNumber?: bigint,
  ): Promise<Result<CreditAccount>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress)
        throw new InvalidValue(
          "Must provide an address or connect a wallet client",
        );
      const args = [forAddress] satisfies GetAccountParams;
      const result = await this.contract.read.getAccount(args, { blockNumber });
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound } = isActorNotFoundError(error);
        if (isActorNotFound) {
          const emptyAccount = {
            capacityUsed: 0n,
            creditFree: 0n,
            creditCommitted: 0n,
            creditSponsor: zeroAddress,
            lastDebitEpoch: 0n,
            approvalsTo: [],
            approvalsFrom: [],
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
    forAddress?: Address,
    {
      filterFrom,
      filterTo,
      blockNumber,
    }: {
      filterFrom?: Address;
      filterTo?: Address;
      blockNumber?: bigint;
    } = {},
  ): Promise<Result<CreditApproval>> {
    let {
      result: { approvalsTo, approvalsFrom },
    } = await this.getAccount(forAddress, blockNumber);
    // Filter approvals by `to`, if provided
    approvalsTo = filterTo
      ? approvalsTo.filter((approval) => approval.addr === filterTo)
      : approvalsTo;
    // Filter approvals by `from`, if provided
    approvalsFrom = filterFrom
      ? approvalsFrom.filter((approval) => approval.addr === filterFrom)
      : approvalsFrom;
    return { result: { approvalsTo, approvalsFrom } };
  }

  // Get credit balance
  async getCreditBalance(
    address?: Address,
    blockNumber?: bigint,
  ): Promise<Result<CreditBalance>> {
    try {
      const forAddress = address || this.client.walletClient?.account?.address;
      if (!forAddress)
        throw new InvalidValue(
          "Must provide an address or connect a wallet client",
        );
      const args = [forAddress] satisfies GetAccountParams;
      const result = await this.contract.read.getAccount(args, {
        blockNumber,
      });
      const creditBalance = {
        creditFree: result.creditFree,
        creditCommitted: result.creditCommitted,
        creditSponsor: result.creditSponsor,
        lastDebitEpoch: result.lastDebitEpoch,
        approvalsTo: result.approvalsTo,
        approvalsFrom: result.approvalsFrom,
        maxTtl: result.maxTtl,
        gasAllowance: result.gasAllowance,
      } as CreditBalance;
      return { result: creditBalance };
    } catch (error: unknown) {
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
            approvalsTo: [],
            approvalsFrom: [],
            maxTtl: 0n,
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
      // Technically, the same contract but different interface/ABI
      const blobsContract = getContract({
        abi: iBlobsFacadeAbi,
        address: this.getContract().address,
        client: {
          public: this.client.publicClient,
          wallet: this.client.walletClient!,
        },
      });
      const result = await blobsContract.read.getStats({ blockNumber });
      const creditStats = {
        balance: result.balance,
        creditSold: result.creditSold,
        creditCommitted: result.creditCommitted,
        creditDebited: result.creditDebited,
        tokenCreditRate: result.tokenCreditRate,
        numAccounts: result.numAccounts,
      } as CreditStats;
      return { result: creditStats };
    } catch (error: unknown) {
      throw new UnhandledCreditError(`Failed to get credit stats: ${error}`);
    }
  }
}
