import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionArgs,
  ContractFunctionReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
  zeroAddress,
} from "viem";
import { blobManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { blobManagerAddress, LOCALNET_OBJECT_API_URL, MIN_TTL } from "../constants.js";
import { getObjectsNodeInfo } from "../provider/object.js";
import { InvalidValue, UnhandledBlobError } from "./errors.js";
import { DeepMutable, parseEventFromTransaction, type Result } from "./utils.js";

// Used for getBlob()
export type BlobInfo = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getBlob">
>;

// Used for getAddedBlobs()
export type AddedBlobs = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getAddedBlobs">
>;

// Used for getPendingBlobs()
export type PendingBlobs = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getPendingBlobs">
>;

// Used for getPendingBlobsCount()
export type PendingBlobsCount = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getPendingBlobsCount">
>;

// Used for getPendingBytesCount()
export type PendingBytesCount = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getPendingBytesCount">
>;

// Used for getStorageStats()
export type StorageStats = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getStorageStats">
>;

// Used for getBlobStatus()
export type BlobStatus = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getBlobStatus">
>;

// Used for getStorageUsage()
export type StorageUsage = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getStorageUsage">
>;

// Used for getSubnetStats()
export type SubnetStats = DeepMutable<
  ContractFunctionReturnType<typeof blobManagerABI, AbiStateMutability, "getSubnetStats">
>;

// Used for addBlob()
type AddBlobFullParams = ContractFunctionArgs<typeof blobManagerABI, AbiStateMutability, "addBlob">;

// Used for addBlob()
type AddBlobParams = DeepMutable<
  Extract<
    AddBlobFullParams[0],
    {
      sponsor: Address;
      source: string;
      blobHash: string;
      metadataHash: string;
      subscriptionId: string;
      size: bigint;
      ttl: bigint;
    }
  >
>;

export type AddBlobOptions = {
  ttl?: bigint;
  sponsor?: Address;
};

// Used for getBlob()
type GetBlobParams = ContractFunctionArgs<typeof blobManagerABI, AbiStateMutability, "getBlob">;

// Used for getBlobStatus()
type GetBlobStatusParams = ContractFunctionArgs<
  typeof blobManagerABI,
  AbiStateMutability,
  "getBlobStatus"
>;

// Used for deleteBlob()
type DeleteBlobParams = ContractFunctionArgs<
  typeof blobManagerABI,
  AbiStateMutability,
  "deleteBlob"
>;

// Used for addBlob()
export type AddBlobResult = Required<
  GetEventArgs<typeof blobManagerABI, "AddBlob", { IndexedOnly: false }>
>;

// Used for deleteBlob()
export type DeleteBlobResult = Required<
  GetEventArgs<typeof blobManagerABI, "DeleteBlob", { IndexedOnly: false }>
>;

// Used for overwriteBlob()
export type OverwriteBlobParams = ContractFunctionArgs<
  typeof blobManagerABI,
  AbiStateMutability,
  "overwriteBlob"
>;

// Used for overwriteBlob()
export type OverwriteBlobResult = Required<
  GetEventArgs<typeof blobManagerABI, "OverwriteBlob", { IndexedOnly: false }>
>;

export class BlobManager {
  client: HokuClient;
  contract: GetContractReturnType<typeof blobManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBlobManagerAddress = (blobManagerAddress as Record<number, Address>)[chainId];
    if (!deployedBlobManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    this.contract = getContract({
      abi: blobManagerABI,
      address: contractAddress || deployedBlobManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });
  }

  getContract(): GetContractReturnType<typeof blobManagerABI, Client, Address> {
    return this.contract;
  }

  // Add blob inner
  async addBlobInner(addParams: AddBlobParams): Promise<Result<AddBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding blobs");
    }
    try {
      const args = [addParams] satisfies AddBlobFullParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "addBlob",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const result = (await parseEventFromTransaction<AddBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "AddBlob",
        hash
      )) as AddBlobResult;
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      return { meta: { tx }, result };
    } catch (error) {
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
    options: AddBlobOptions = {}
  ): Promise<Result<AddBlobResult>> {
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const { nodeId: source } = await getObjectsNodeInfo(LOCALNET_OBJECT_API_URL);
    const addParams = {
      sponsor: options.sponsor ?? zeroAddress,
      source,
      blobHash,
      metadataHash: "",
      subscriptionId,
      size,
      ttl,
    } as AddBlobParams;
    return this.addBlobInner(addParams);
  }

  // Delete blob
  async deleteBlob(
    blobHash: string,
    subscriptionId: string,
    subscriber?: Address
  ): Promise<Result<DeleteBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for deleting blobs");
    }
    try {
      const args = [subscriber || zeroAddress, blobHash, subscriptionId] satisfies DeleteBlobParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "deleteBlob",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const result = (await parseEventFromTransaction<DeleteBlobResult>(
        this.client.publicClient,
        this.contract.abi,
        "DeleteBlob",
        hash
      )) as DeleteBlobResult;
      return { meta: { tx }, result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to delete blob: ${error}`);
    }
  }

  // Get blob info
  // TODO: there's no way to download raw blobs from the objects API (it requires a bucket and a key)
  async getBlob(blobHash: string, blockNumber?: bigint): Promise<Result<BlobInfo>> {
    try {
      const args = [blobHash] satisfies GetBlobParams;
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getBlob",
        args,
        blockNumber,
      })) as BlobInfo;
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get blob info: ${error}`);
    }
  }

  // Get blob status
  async getBlobStatus(
    subscriber: Address,
    blobHash: string,
    subscriptionId: string,
    blockNumber?: bigint
  ): Promise<Result<BlobStatus>> {
    try {
      const args = [subscriber, blobHash, subscriptionId] satisfies GetBlobStatusParams;
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getBlobStatus",
        args,
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get blob status: ${error}`);
    }
  }

  // Overwrite blob inner
  async overwriteBlobInner(
    oldHash: string,
    addParams: AddBlobParams
  ): Promise<Result<OverwriteBlobResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for overwriting blobs");
    }
    const params = [oldHash, addParams] satisfies OverwriteBlobParams;
    const { request } = await this.client.publicClient.simulateContract({
      address: this.contract.address,
      abi: this.contract.abi,
      functionName: "overwriteBlob",
      args: params,
      account: this.client.walletClient.account,
    });
    const hash = await this.client.walletClient.writeContract(request);
    const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
    const result = (await parseEventFromTransaction<OverwriteBlobResult>(
      this.client.publicClient,
      this.contract.abi,
      "OverwriteBlob",
      hash
    )) as OverwriteBlobResult;
    return { meta: { tx }, result };
  }

  // Overwrite blob
  async overwriteBlob(
    oldHash: string,
    newHash: string,
    subscriptionId: string,
    size: bigint,
    options: AddBlobOptions = {}
  ): Promise<Result<OverwriteBlobResult>> {
    const { nodeId: source } = await getObjectsNodeInfo(LOCALNET_OBJECT_API_URL);
    const params = {
      sponsor: options.sponsor ?? zeroAddress,
      source,
      blobHash: newHash,
      metadataHash: "",
      subscriptionId,
      size,
      ttl: options.ttl ?? 0n,
    } as AddBlobParams;
    return this.overwriteBlobInner(oldHash, params);
  }

  // Get added blobs
  async getAddedBlobs(size: number, blockNumber?: bigint): Promise<Result<AddedBlobs>> {
    try {
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getAddedBlobs",
        args: [size],
        blockNumber,
      })) as AddedBlobs;
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get added blobs: ${error}`);
    }
  }

  // Get pending blobs
  async getPendingBlobs(size: number, blockNumber?: bigint): Promise<Result<PendingBlobs>> {
    try {
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getPendingBlobs",
        args: [size],
        blockNumber,
      })) as PendingBlobs;
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get pending blobs count: ${error}`);
    }
  }

  // Get pending blobs count
  async getPendingBlobsCount(blockNumber?: bigint): Promise<Result<PendingBlobsCount>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getPendingBlobsCount",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get pending blobs count: ${error}`);
    }
  }

  // Get pending bytes count
  async getPendingBytesCount(blockNumber?: bigint): Promise<Result<PendingBytesCount>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getPendingBytesCount",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get pending bytes count: ${error}`);
    }
  }

  // Get storage stats
  async getStorageStats(blockNumber?: bigint): Promise<Result<StorageStats>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageStats",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get storage stats: ${error}`);
    }
  }

  // Get storage usage
  async getStorageUsage(address?: Address, blockNumber?: bigint): Promise<Result<StorageUsage>> {
    const addressArg = address || this.client.walletClient?.account?.address;
    if (!addressArg) {
      throw new Error("Address is required for getting storage usage");
    }
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getStorageUsage",
        args: [addressArg],
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get storage usage: ${error}`);
    }
  }

  // Get subnet stats
  async getSubnetStats(blockNumber?: bigint): Promise<Result<SubnetStats>> {
    try {
      const result = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "getSubnetStats",
        blockNumber,
      });
      return { result };
    } catch (error) {
      throw new UnhandledBlobError(`Failed to get subnet stats: ${error}`);
    }
  }
}
