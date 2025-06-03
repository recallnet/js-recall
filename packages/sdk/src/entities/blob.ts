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
  getContract,
  zeroAddress,
} from "viem";

import { getObjectApiUrl } from "@recallnet/chains";
import {
  iBlobsFacadeAbi,
  iBlobsFacadeAddress,
  iCreditFacadeAbi,
} from "@recallnet/contracts";
import { MIN_TTL } from "@recallnet/network-constants";

import { RecallClient } from "../client.js";
import {
  ActorNotFound,
  InvalidValue,
  UnhandledBlobError,
  isActorNotFoundError,
} from "../errors.js";
import { getObjectsNodeInfo } from "../provider.js";
import { type Result, base32ToHex } from "../utils.js";

// Used for getBlob()
export type BlobInfo = ContractFunctionReturnType<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "getBlob"
>;

// Used for getSubnetStats()
export type SubnetStats = ContractFunctionReturnType<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "getStats"
>;

// Used for getStorageUsage()
export type StorageUsage = bigint;

// Used for getStorageStats()
export type StorageStats = Pick<
  SubnetStats,
  | "capacityFree"
  | "capacityUsed"
  | "numBlobs"
  | "numResolving"
  | "numAccounts"
  | "bytesResolving"
  | "numAdded"
  | "bytesAdded"
>;

// Used for addBlob()
export type AddBlobParams = ContractFunctionArgs<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "addBlob"
>;

export type AddBlobOptions = {
  ttl?: bigint;
  sponsor?: Address;
};

// Used for getBlob()
export type GetBlobParams = ContractFunctionArgs<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "getBlob"
>;

// Used for deleteBlob()
export type DeleteBlobParams = ContractFunctionArgs<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "deleteBlob"
>;

// Used for overwriteBlob()
export type OverwriteBlobParams = ContractFunctionArgs<
  typeof iBlobsFacadeAbi,
  AbiStateMutability,
  "overwriteBlob"
>;

export class BlobManager {
  client: RecallClient;
  contract: GetContractReturnType<typeof iBlobsFacadeAbi, Client, Address>;

  constructor(client: RecallClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBlobManagerAddress = (
      iBlobsFacadeAddress as Record<number, Address>
    )[chainId];
    if (!deployedBlobManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}`);
    }
    this.contract = getContract({
      abi: iBlobsFacadeAbi,
      address: contractAddress || deployedBlobManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<
    typeof iBlobsFacadeAbi,
    Client,
    Address
  > {
    return this.contract;
  }

  // Add blob inner
  async addBlobInner(args: AddBlobParams): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding blobs");
    }
    try {
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.addBlob<Chain, Account>(
        args,
        {
          account: this.client.walletClient.account,
          gasPrice,
        },
      );
      // TODO: calling `this.contract.write.addBlob(...)` doesn't work, for some reason
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
      throw new UnhandledBlobError(`Failed to add blob: ${error}`);
    }
  }

  // Add blob
  // TODO: this assumes the blob already exists on the network; there's no way to upload raw blobs
  // to the objects API (it requires a bucket and a key)
  async addBlob(
    blobHash: string,
    subscriptionId: string,
    size: bigint,
    options: AddBlobOptions = {},
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding blobs");
    }
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const objectApiUrl = getObjectApiUrl(this.client.walletClient.chain);
    const { nodeId: source } = await getObjectsNodeInfo(objectApiUrl);
    const addParams = [
      options.sponsor ?? zeroAddress,
      `0x${source}`, // Objects API returns the bytes32 value without the 0x prefix
      base32ToHex(blobHash),
      "0x0000000000000000000000000000000000000000000000000000000000000000", // Empty 32 bytes
      subscriptionId,
      size,
      ttl,
    ] satisfies AddBlobParams;
    return this.addBlobInner(addParams);
  }

  // Delete blob
  async deleteBlob(
    blobHash: string,
    subscriptionId: string,
    subscriber?: Address,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for deleting blobs");
    }
    try {
      const args = [
        subscriber || zeroAddress,
        base32ToHex(blobHash),
        subscriptionId,
      ] satisfies DeleteBlobParams;
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.deleteBlob<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.deleteBlob(...)` doesn't work, for some reason
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
      throw new UnhandledBlobError(`Failed to delete blob: ${error}`);
    }
  }

  // Get blob info
  // TODO: there's no way to download raw blobs from the objects API (it requires a bucket and a key)
  async getBlob(
    blobHash: string,
    blockNumber?: bigint,
  ): Promise<Result<BlobInfo>> {
    try {
      const args = [base32ToHex(blobHash)] satisfies GetBlobParams;
      const result = await this.contract.read.getBlob(args, { blockNumber });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get blob info: ${error}`);
    }
  }

  // Overwrite blob inner
  async overwriteBlobInner(
    oldHash: string,
    addParams: AddBlobParams,
  ): Promise<Result> {
    try {
      if (!this.client.walletClient?.account) {
        throw new Error(
          "Wallet client is not initialized for overwriting blobs",
        );
      }
      const params = [
        base32ToHex(oldHash),
        ...addParams,
      ] satisfies OverwriteBlobParams;
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.contract.simulate.overwriteBlob<
        Chain,
        Account
      >(params, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.overwriteBlob(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to overwrite blob: ${error}`);
    }
  }

  // Overwrite blob
  async overwriteBlob(
    oldHash: string,
    newHash: string,
    subscriptionId: string,
    size: bigint,
    options: AddBlobOptions = {},
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for overwriting blobs");
    }
    const objectApiUrl = getObjectApiUrl(this.client.walletClient.chain);
    const { nodeId: source } = await getObjectsNodeInfo(objectApiUrl);
    const params = [
      options.sponsor ?? zeroAddress,
      `0x${source}`, // Objects API returns the bytes32 value without the 0x prefix
      base32ToHex(newHash),
      "0x0000000000000000000000000000000000000000000000000000000000000000", // Empty 32 bytes
      subscriptionId,
      size,
      options.ttl ?? 0n,
    ] satisfies AddBlobParams;
    return this.overwriteBlobInner(oldHash, params);
  }

  // Get storage stats
  async getStorageStats(blockNumber?: bigint): Promise<Result<StorageStats>> {
    try {
      const result = await this.contract.read.getStats({ blockNumber });
      const stats = {
        capacityFree: result.capacityFree,
        capacityUsed: result.capacityUsed,
        numBlobs: result.numBlobs,
        numResolving: result.numResolving,
        numAccounts: result.numAccounts,
        bytesResolving: result.bytesResolving,
        numAdded: result.numAdded,
        bytesAdded: result.bytesAdded,
      } satisfies StorageStats;
      return { result: stats };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get storage stats: ${error}`);
    }
  }

  // Get storage usage
  async getStorageUsage(
    address?: Address,
    blockNumber?: bigint,
  ): Promise<Result<bigint>> {
    const addressArg = address || this.client.walletClient?.account?.address;
    if (!addressArg) {
      throw new Error("Address is required for getting storage usage");
    }
    try {
      // Technically, the same contract but different interface/ABI
      const creditContract = getContract({
        abi: iCreditFacadeAbi,
        address: this.getContract().address,
        client: {
          public: this.client.publicClient,
          wallet: this.client.walletClient!,
        },
      });
      const result = await creditContract.read.getAccount([addressArg], {
        blockNumber,
      });
      return { result: result.capacityUsed };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
      }
      throw new UnhandledBlobError(`Failed to get storage usage: ${error}`);
    }
  }

  // Get subnet stats
  async getSubnetStats(blockNumber?: bigint): Promise<Result<SubnetStats>> {
    try {
      const result = await this.contract.read.getStats({ blockNumber });
      return { result };
    } catch (error: unknown) {
      throw new UnhandledBlobError(`Failed to get subnet stats: ${error}`);
    }
  }
}
