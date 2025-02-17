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
  getContract,
} from "viem";

import { bucketManagerAbi, bucketManagerAddress } from "@recallnet/contracts";
import { cbor } from "@recallnet/fvm/utils";
import { MAX_OBJECT_SIZE, MIN_TTL } from "@recallnet/network-constants";

import { RecallClient } from "../client.js";
import {
  callObjectsApiAddObject,
  downloadBlob,
  getObjectsNodeInfo,
} from "../provider/object.js";
import { FileHandler, createFileHandler } from "../provider/utils.js";
import {
  ActorNotFound,
  AddObjectError,
  BucketNotFound,
  CreateBucketError,
  InvalidValue,
  ObjectNotFound,
  UnhandledBucketError,
  isActorNotFoundError,
} from "./errors.js";
import {
  type Result,
  actorIdToMaskedEvmAddress,
  convertAbiMetadataToObject,
  convertMetadataToAbiParams,
  parseEventFromTransaction,
} from "./utils.js";

// Used for add()
export type AddOptions = {
  ttl?: bigint;
  metadata?: Record<string, string>;
  overwrite?: boolean;
};

// Used for get()
export type ObjectValueRaw = ContractFunctionReturnType<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "getObject"
>;

// Converts metadata Solidity struct to normal javascript object
export type ObjectValue = Pick<
  ObjectValueRaw,
  "blobHash" | "recoveryHash" | "size" | "expiry"
> & {
  metadata: Record<string, unknown>;
};

// Used for list()
export type ListResultRaw = ContractFunctionReturnType<
  typeof bucketManagerAbi,
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
  typeof bucketManagerAbi,
  "view",
  "queryObjects",
  [
    bucket: `0x${string}`,
    prefix: string,
    delimiter: string,
    startKey: string,
    limit: bigint,
  ]
>;

// Converts metadata Solidity struct to normal javascript object
export type QueryResult = Omit<QueryResultRaw, "objects"> & {
  objects: {
    key: QueryResultRaw["objects"][number]["key"];
    state: Omit<QueryResultRaw["objects"][number]["state"], "metadata"> & {
      metadata: Record<string, unknown>;
    };
  }[];
};

// Note: this emits raw cbor bytes, so we need to decode it to get the bucket address
export type CreateBucketEvent = Required<
  GetEventArgs<typeof bucketManagerAbi, "CreateBucket", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketResult = {
  owner: Address;
  bucket: Address;
};

// Used for add()
export type AddObjectResult = Required<
  GetEventArgs<typeof bucketManagerAbi, "AddObject", { IndexedOnly: false }>
>;

// Used for delete()
export type DeleteObjectResult = Required<
  GetEventArgs<typeof bucketManagerAbi, "DeleteObject", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketParams = Extract<
  ContractFunctionArgs<
    typeof bucketManagerAbi,
    AbiStateMutability,
    "createBucket"
  >,
  readonly [Address, readonly { key: string; value: string }[]]
>;

// Used for get()
export type GetObjectParams = ContractFunctionArgs<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "getObject"
>;

// Used for delete()
export type DeleteObjectParams = ContractFunctionArgs<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "deleteObject"
>;

// Used for query()
export type QueryObjectsParams = ContractFunctionArgs<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "queryObjects"
>;

// Used for add()
export type AddObjectFullParams = ContractFunctionArgs<
  typeof bucketManagerAbi,
  AbiStateMutability,
  "addObject"
>;

// Used for add()
export type AddObjectParams = Extract<
  AddObjectFullParams[1],
  {
    source: string;
    key: string;
    blobHash: string;
    recoveryHash: string;
    size: bigint;
    ttl: bigint;
    metadata: readonly {
      key: string;
      value: string;
    }[];
    overwrite: boolean;
  }
>;

export class BucketManager {
  private fileHandler: FileHandler;
  client: RecallClient;
  contract: GetContractReturnType<typeof bucketManagerAbi, Client, Address>;

  constructor(client: RecallClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBucketManagerAddress = (
      bucketManagerAddress as Record<number, Address>
    )[chainId];
    if (!deployedBucketManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    this.contract = getContract({
      abi: bucketManagerAbi,
      address: contractAddress || deployedBucketManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });

    // Detect environment and set appropriate handler
    this.fileHandler = createFileHandler();
  }

  getContract(): GetContractReturnType<
    typeof bucketManagerAbi,
    Client,
    Address
  > {
    return this.contract;
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
      const { request } = await this.contract.simulate.createBucket<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
      });
      const hash = await this.contract.write.createBucket(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const { owner: eventOwner, data } =
        await parseEventFromTransaction<CreateBucketEvent>(
          this.client.publicClient,
          this.contract.abi,
          "CreateBucket",
          hash,
        );
      // The first value is the actor's ID, the second is the robust t2 address payload; we don't use the robust address
      // See `CreateExternalReturn`: https://github.com/recallnet/ipc/blob/35abe5f4be2d0dddc9d763ce69bdc4d39a148d0f/fendermint/vm/actor_interface/src/adm.rs#L66
      // We need to decode the actor ID from the CBOR and then convert it to an Ethereum address
      // The actor ID needs to be LEB128 encoded, and the FVM ID address is 1 byte of 0x00 followed by the actor ID
      const decoded = cbor.decode(data);
      const actorId = decoded[0] as number;
      const bucket = actorIdToMaskedEvmAddress(actorId);
      return { meta: { tx }, result: { owner: eventOwner, bucket } };
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
      const listResult = await this.contract.read.listBuckets(
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
  // TODO: should this be private and used internally by `add`
  async addInner(
    bucket: Address,
    addParams: AddObjectParams,
  ): Promise<Result<AddObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const args = [bucket, addParams] satisfies AddObjectFullParams;
      const { request } = await this.contract.simulate.addObject<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
      });
      // TODO: calling `this.contract.write.addObject(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const result = await parseEventFromTransaction<AddObjectResult>(
        this.client.publicClient,
        this.contract.abi,
        "AddObject",
        hash,
      );
      return { meta: { tx }, result };
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
  ): Promise<Result<AddObjectResult>> {
    if (!this.client.walletClient || !this.client.walletClient.chain) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    const metadataRaw = options?.metadata ?? {};
    const { data, contentType, size } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadataRaw["content-type"] = contentType;
    }
    const metadata = convertMetadataToAbiParams(metadataRaw);
    const objectApiUrl = this.client.network.objectApiUrl();
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
    const addParams = {
      source,
      key,
      blobHash: hash,
      recoveryHash: metadataHash,
      size,
      ttl,
      metadata,
      overwrite: options?.overwrite ?? false,
    } as AddObjectParams;
    return await this.addInner(bucket, addParams);
  }

  // Delete an object from a bucket
  async delete(
    bucket: Address,
    key: string,
  ): Promise<Result<DeleteObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const args = [bucket, key] satisfies DeleteObjectParams;
      const { request } = await this.contract.simulate.deleteObject<
        Chain,
        Account
      >(args, {
        account: this.client.walletClient.account,
      });
      // TODO: calling `this.contract.write.deleteObject(...)` doesn't work, for some reason
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({
        hash,
      });
      const result = await parseEventFromTransaction<DeleteObjectResult>(
        this.client.publicClient,
        this.contract.abi,
        "DeleteObject",
        hash,
      );
      return { meta: { tx }, result };
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
      const args = [bucket, key] satisfies GetObjectParams;
      const getResult = await this.contract.read.getObject(args, {
        blockNumber,
      });
      if (!getResult.blobHash) {
        throw new ObjectNotFound(bucket, key);
      }
      const result = {
        blobHash: getResult.blobHash,
        recoveryHash: getResult.recoveryHash,
        size: getResult.size,
        expiry: getResult.expiry,
        metadata: convertAbiMetadataToObject(getResult.metadata),
      } as ObjectValue;
      return { result };
    } catch (error: unknown) {
      if (error instanceof ObjectNotFound) {
        throw error;
      } else if (error instanceof ContractFunctionExecutionError) {
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
      const objectApiUrl = this.client.network.objectApiUrl();
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
      const objectApiUrl = this.client.network.objectApiUrl();
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
    options?: {
      prefix?: string;
      delimiter?: string;
      startKey?: string;
      limit?: number;
      blockNumber?: bigint;
    },
  ): Promise<Result<QueryResult>> {
    try {
      const args = [
        bucket,
        options?.prefix ?? "",
        options?.delimiter ?? "/",
        options?.startKey ?? "",
        BigInt(options?.limit ?? 100),
      ] satisfies QueryObjectsParams;
      const { objects, commonPrefixes, nextKey } =
        (await this.contract.read.queryObjects(args, {
          blockNumber: options?.blockNumber,
        })) as QueryResultRaw;
      const result = {
        objects: objects.map(({ key, state }) => ({
          key,
          state: {
            blobHash: state.blobHash,
            size: state.size,
            metadata: convertAbiMetadataToObject(state.metadata),
          },
        })),
        commonPrefixes,
        nextKey,
      };
      return { result };
    } catch (error: unknown) {
      if (error instanceof ContractFunctionExecutionError) {
        // TODO: We're optimistically assuming an error means the bucket doesn't exist
        // 00: t0134 (method 3844450837) -- contract reverted (33)
        // 01: t0134 (method 6) -- contract reverted (33)
        throw new BucketNotFound(bucket);
      }
      throw new UnhandledBucketError(`Failed to query bucket: ${error}`);
    }
  }
}
