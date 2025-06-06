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
  GetEventArgs,
  Hex,
  getContract,
} from "viem";

import { getObjectApiUrl } from "@recallnet/chains";
import {
  iBucketFacadeAbi,
  iMachineFacadeAbi,
  iMachineFacadeAddress,
} from "@recallnet/contracts";
import { hexToBase32 } from "@recallnet/fvm/utils";
import {
  MAX_OBJECT_SIZE,
  MAX_QUERY_LIMIT,
  MIN_TTL,
} from "@recallnet/network-constants";

import { RecallClient } from "../client.js";
import {
  ActorNotFound,
  AddObjectError,
  BucketNotFound,
  CreateBucketError,
  InvalidValue,
  ObjectNotFound,
  OutOfGasError,
  UnhandledBucketError,
  isActorNotFoundError,
  isEmptyResponseError,
} from "../errors.js";
import {
  callObjectsApiAddObject,
  downloadBlob,
  getObjectsNodeInfo,
} from "../provider.js";
import {
  type Result,
  convertAbiMetadataToObject,
  convertMetadataToAbiParams,
  parseEventFromTransaction,
} from "../utils.js";
import { FileHandler, base32ToHex, createFileHandler } from "../utils.js";

// Used for add()
export type AddOptions = {
  ttl?: bigint;
  metadata?: Record<string, string>;
  overwrite?: boolean;
};

// Used for get()
export type ObjectValueRaw = ContractFunctionReturnType<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "getObject"
>;

// Converts metadata Solidity struct to normal javascript object
export type ObjectValue = Pick<ObjectValueRaw, "size" | "expiry"> & {
  blobHash: string; // Use base32 string value instead of bytes32
  recoveryHash: string; // Use base32 string value instead of bytes32
  metadata: Record<string, unknown>;
};

// Used for list()
export type ListResultRaw = ContractFunctionReturnType<
  typeof iMachineFacadeAbi,
  AbiStateMutability,
  "listBuckets"
>;

// Converts metadata Solidity struct to normal javascript object
export type ListResultRawBucket = ListResultRaw[number];

export type ListResultBucket = Pick<ListResultRawBucket, "kind" | "addr"> & {
  metadata: Record<string, unknown>;
};

export type ListResult = ListResultBucket[];

// Used for query()
export type QueryResultRaw = ContractFunctionReturnType<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "queryObjects"
>;

// Object value in query response (converted `metadata` to normal javascript object)
export type QueryObjectValue = Omit<
  QueryResultRaw["objects"][number]["state"],
  "metadata"
> & {
  metadata: Record<string, unknown>;
};

// Object in query response
export type QueryResultObject = {
  key: QueryResultRaw["objects"][number]["key"];
  state: QueryObjectValue;
};

// Converts metadata Solidity struct to normal javascript object
export type QueryResult = Omit<QueryResultRaw, "objects"> & {
  objects: QueryResultObject[];
};

// Options for query()
export type QueryOptions = {
  prefix?: string;
  delimiter?: string;
  startKey?: string;
  limit?: number;
  blockNumber?: bigint;
};

// Note: this event stems from the underlying machine facade contract; creating a bucket
// emits a `MachineInitialized` event, which contains the bucket address
export type CreateBucketEvent = Required<
  GetEventArgs<
    typeof iMachineFacadeAbi,
    "MachineInitialized",
    { IndexedOnly: false }
  >
>;

// Used for create()
export type CreateBucketResult = {
  bucket: Address;
};

// Used for create()
export type CreateBucketParams = Extract<
  ContractFunctionArgs<
    typeof iMachineFacadeAbi,
    AbiStateMutability,
    "createBucket"
  >,
  readonly [Address, readonly { key: string; value: string }[]]
>;

// Used for get()
export type GetObjectParams = ContractFunctionArgs<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "getObject"
>;

// Used for delete()
export type DeleteObjectParams = ContractFunctionArgs<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "deleteObject"
>;

// Used for query()
export type QueryObjectsParams = ContractFunctionArgs<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "queryObjects"
>;

// Used for add()
type AddObjectFullParams = ContractFunctionArgs<
  typeof iBucketFacadeAbi,
  AbiStateMutability,
  "addObject"
>;

// Extract the full params variation with all fields
type AddObjectParams = Extract<
  AddObjectFullParams,
  readonly [
    Hex,
    string,
    Hex,
    Hex,
    bigint,
    bigint,
    readonly {
      key: string;
      value: string;
    }[],
    boolean,
  ]
>;

export class BucketManager {
  private fileHandler: FileHandler;
  client: RecallClient;
  factoryContract: GetContractReturnType<
    typeof iMachineFacadeAbi,
    Client,
    Address
  >;

  constructor(client: RecallClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBucketManagerAddress = (
      iMachineFacadeAddress as Record<number, Address>
    )[chainId];
    if (!deployedBucketManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}`);
    }
    this.factoryContract = getContract({
      abi: iMachineFacadeAbi,
      address: contractAddress || deployedBucketManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });

    // Detect environment and set appropriate handler
    this.fileHandler = createFileHandler();
  }

  // Get the machine (ADM) contract for creating or listing buckets
  getFactoryContract(): GetContractReturnType<
    typeof iMachineFacadeAbi,
    Client,
    Address
  > {
    return this.factoryContract;
  }

  // Get an instance of the bucket contract for adding, deleting, and querying objects
  getBucketContract(
    address: Address,
  ): GetContractReturnType<typeof iBucketFacadeAbi, Client, Address> {
    return getContract({
      abi: iBucketFacadeAbi,
      address,
      client: this.client.publicClient,
    });
  }

  // Create a bucket
  async create({
    owner,
    metadata,
  }: {
    owner?: Address;
    metadata?: Record<string, string>;
  } = {}): Promise<Result<CreateBucketResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for creating a bucket");
    }
    try {
      const args = [
        owner ?? this.client.walletClient.account.address,
        metadata ? convertMetadataToAbiParams(metadata) : [],
      ] satisfies CreateBucketParams;
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.factoryContract.simulate.createBucket<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      const hash = await this.factoryContract.write.createBucket(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const { machineAddress } =
        await parseEventFromTransaction<CreateBucketEvent>(
          this.client.publicClient,
          iMachineFacadeAbi,
          "MachineInitialized",
          hash,
        );
      return { meta: { tx }, result: { bucket: machineAddress } };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound, address } = isActorNotFoundError(error);
        if (isActorNotFound) {
          throw new ActorNotFound(address as Address);
        }
        throw new CreateBucketError(error.message);
      }
      throw new UnhandledBucketError(`Failed to create bucket: ${error}`);
    }
  }

  // List buckets
  async list(
    owner?: Address,
    blockNumber?: bigint,
  ): Promise<Result<ListResult>> {
    let effectiveOwner: Address;
    if (owner) {
      effectiveOwner = owner;
    } else if (this.client.walletClient?.account) {
      effectiveOwner = this.client.walletClient.account.address;
    } else {
      throw new Error("No owner provided or wallet client not initialized");
    }

    try {
      const listResult = await this.factoryContract.read.listBuckets(
        [effectiveOwner],
        {
          blockNumber,
        },
      );
      const result = listResult.map((bucket) => ({
        ...bucket,
        metadata: convertAbiMetadataToObject(bucket.metadata),
      }));
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        const { isActorNotFound } = isActorNotFoundError(error);
        if (isActorNotFound) {
          return { result: [] };
        }
      }
      throw new UnhandledBucketError(`Failed to list buckets: ${error}`);
    }
  }

  // Add an object to a bucket inner
  private async executeAdd(
    bucket: Address,
    args: AddObjectParams,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.getBucketContract(
        bucket,
      ).simulate.addObject<Chain, Account>(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.addObject(...)` doesn't work, for some reason
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
        throw new AddObjectError(error.message);
      }
      throw new UnhandledBucketError(`${error}`);
    }
  }

  // Add an object to a bucket
  async add(
    bucket: Address,
    key: string,
    file: string | File | Uint8Array,
    options?: AddOptions,
  ): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    const metadataRaw = options?.metadata ?? {};
    const { data, contentType, size } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadataRaw["content-type"] = contentType;
    }
    const metadata = convertMetadataToAbiParams(metadataRaw);
    const objectApiUrl = getObjectApiUrl(this.client.walletClient.chain);
    const { nodeId: source } = await getObjectsNodeInfo(objectApiUrl);
    if (size > MAX_OBJECT_SIZE) {
      throw new InvalidValue(
        `Object size must be less than ${MAX_OBJECT_SIZE} bytes`,
      );
    }
    // TTL of zero is interpreted by Solidity wrappers as null
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const { hash, metadataHash } = await callObjectsApiAddObject(
      objectApiUrl,
      data,
      size,
      contentType,
    );
    const addParams = [
      `0x${source}`,
      key,
      base32ToHex(hash),
      base32ToHex(metadataHash),
      size,
      ttl,
      metadata,
      options?.overwrite ?? false,
    ] satisfies AddObjectParams;
    return await this.executeAdd(bucket, addParams);
  }

  // Delete an object from a bucket
  async delete(bucket: Address, key: string): Promise<Result> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const args = [key] satisfies DeleteObjectParams;
      const gasPrice = await this.client.publicClient.getGasPrice();
      const { request } = await this.getBucketContract(
        bucket,
      ).simulate.deleteObject<Chain, Account>(args, {
        account: this.client.walletClient.account,
        gasPrice,
      });
      // TODO: calling `this.contract.write.deleteObject(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      return { meta: { tx }, result: {} };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        // Check for specific error messages
        if (error.message.includes("object not found")) {
          throw new ObjectNotFound(bucket, key);
        }
        // TODO: We're optimistically assuming an error means the bucket doesn't exist
        // 00: t0134 (method 3844450837) -- contract reverted (33)
        // 01: t0134 (method 6) -- contract reverted (33)
        throw new BucketNotFound(bucket);
      }
      throw new UnhandledBucketError(`Failed to delete object: ${error}`);
    }
  }

  // Get an object from a bucket, without downloading it
  async getObjectValue(
    bucket: Address,
    key: string,
    blockNumber?: bigint,
  ): Promise<Result<ObjectValue>> {
    try {
      const args = [key] satisfies GetObjectParams;
      const getResult = await this.getBucketContract(bucket).read.getObject(
        args,
        {
          blockNumber,
        },
      );
      // If the blob hash is 0x00...0, the object doesn't exist
      if (Number(getResult.blobHash) === 0) {
        throw new ObjectNotFound(bucket, key);
      }
      const result = {
        blobHash: hexToBase32(getResult.blobHash),
        recoveryHash: hexToBase32(getResult.recoveryHash),
        size: getResult.size,
        expiry: getResult.expiry,
        metadata: convertAbiMetadataToObject(getResult.metadata),
      } as ObjectValue;
      return { result };
    } catch (error: unknown) {
      if (error instanceof ObjectNotFound) {
        throw error;
      }
      if (error instanceof ContractFunctionExecutionError) {
        if (error.message.includes(`returned no data ("0x")`))
          throw new BucketNotFound(bucket);
        // TODO: We're optimistically assuming an error means the bucket doesn't exist
        // 00: t0134 (method 3844450837) -- contract reverted (33)
        // 01: t0134 (method 6) -- contract reverted (33)
        throw new BucketNotFound(bucket);
      }
      throw new UnhandledBucketError(`Failed to query bucket: ${error}`);
    }
  }

  // Download an object from a bucket, returning a Uint8Array
  async get(
    bucket: Address,
    key: string,
    options?: {
      range?: { start?: number; end?: number };
      blockNumber?: bigint;
    },
  ): Promise<Result<Uint8Array>> {
    try {
      const objectApiUrl = getObjectApiUrl(this.client.publicClient.chain);
      const stream = await downloadBlob(
        objectApiUrl,
        bucket,
        key,
        options?.range,
        options?.blockNumber,
      );
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const result = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
      }
      return { result };
    } catch (error: unknown) {
      if (
        error instanceof InvalidValue ||
        error instanceof ObjectNotFound ||
        error instanceof BucketNotFound
      ) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to download object: ${error}`);
    }
  }

  // Get a readable stream of an object from a bucket
  async getStream(
    bucket: Address,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint,
  ): Promise<Result<ReadableStream<Uint8Array>>> {
    try {
      const objectApiUrl = getObjectApiUrl(this.client.publicClient.chain);
      const result = await downloadBlob(
        objectApiUrl,
        bucket,
        key,
        range,
        blockNumber,
      );
      return { result };
    } catch (error: unknown) {
      if (
        error instanceof InvalidValue ||
        error instanceof ObjectNotFound ||
        error instanceof BucketNotFound
      ) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to download object: ${error}`);
    }
  }

  // Query objects in a bucket
  async query(
    bucket: Address,
    options?: QueryOptions,
  ): Promise<Result<QueryResult>> {
    const requestedLimit = options?.limit ?? MAX_QUERY_LIMIT;

    // If within MAX_QUERY_LIMIT, use a single query
    if (requestedLimit <= MAX_QUERY_LIMIT) {
      return this.executeQuery(bucket, options);
    }

    // Otherwise, paginate and collect results. Note: this is needed to avoid
    // hitting gas limits and failing to retrieve all objects.
    try {
      const allObjects: Array<QueryResultObject> = [];
      let currentKey = options?.startKey;
      while (true) {
        const remainingLimit = requestedLimit - allObjects.length;
        const batchLimit = Math.min(MAX_QUERY_LIMIT, remainingLimit);

        const batchResult = await this.executeQuery(bucket, {
          ...options,
          startKey: currentKey,
          limit: batchLimit,
        });
        allObjects.push(...batchResult.result.objects);

        // If no `nextKey` or we've reached the limit, we've collected all objects
        if (
          !batchResult.result.nextKey ||
          allObjects.length >= requestedLimit
        ) {
          return {
            result: {
              objects: allObjects,
              commonPrefixes: batchResult.result.commonPrefixes,
              nextKey: batchResult.result.nextKey,
            },
          };
        }

        // Update `startKey` for next iteration
        currentKey = batchResult.result.nextKey;
      }
    } catch (error: unknown) {
      if (
        error instanceof BucketNotFound ||
        error instanceof OutOfGasError ||
        error instanceof UnhandledBucketError
      ) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to query bucket: ${error}`);
    }
  }

  // Helper method for single query execution
  private async executeQuery(
    bucket: Address,
    options?: QueryOptions,
  ): Promise<Result<QueryResult>> {
    try {
      const args = [
        options?.prefix ?? "",
        options?.delimiter ?? "/",
        options?.startKey ?? "",
        BigInt(options?.limit ?? MAX_QUERY_LIMIT),
      ] satisfies QueryObjectsParams;
      const { objects, commonPrefixes, nextKey } =
        (await this.getBucketContract(bucket).read.queryObjects(args, {
          blockNumber: options?.blockNumber,
        })) as QueryResultRaw;
      const result = {
        objects: objects.map(({ key, state }) => ({
          key,
          state: {
            blobHash: state.blobHash,
            size: state.size,
            expiry: state.expiry,
            metadata: convertAbiMetadataToObject(state.metadata),
          },
        })),
        commonPrefixes,
        nextKey,
      };
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        if (isEmptyResponseError(error)) throw new BucketNotFound(bucket);
        // TODO: since we've migrated to facades over wrappers, is this still needed?
        if (error.message.includes("contract reverted")) {
          const isOutOfGasError =
            error.message.includes("wasm `unreachable` instruction executed") ||
            error.message.includes("out of gas");
          if (isOutOfGasError) {
            throw new OutOfGasError(error.message);
          }
          // We're optimistically assuming this error means the bucket doesn't exist:
          // 00: t0134 (method 3844450837) -- contract reverted (33)
          // 01: t0134 (method 6) -- contract reverted (33)
          throw new BucketNotFound(bucket);
        }
      }
      throw new UnhandledBucketError(`Failed to query bucket: ${error}`);
    }
  }
}
