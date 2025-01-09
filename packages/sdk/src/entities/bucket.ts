import { cbor } from "@hokunet/fvm";
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
import { bucketManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { bucketManagerAddress, LOCALNET_OBJECT_API_URL, MIN_TTL } from "../constants.js";
import {
  callObjectsApiAddObject,
  createIrohNode,
  downloadBlob,
  getObjectsNodeInfo,
  irohNodeTypeToObjectsApiNodeInfo,
  stageDataToIroh,
} from "../provider/object.js";
import { FileHandler, nodeFileHandler, webFileHandler } from "../provider/utils.js";
import {
  BucketNotFound,
  CreateBucketError,
  InvalidValue,
  ObjectNotFound,
  UnhandledBucketError,
} from "./errors.js";
import {
  actorIdToMaskedEvmAddress,
  convertMetadataToAbiParams,
  DeepMutable,
  parseEventFromTransaction,
  type Result,
} from "./utils.js";

// Used for add()
export type AddOptions = {
  ttl?: bigint;
  metadata?: { key: string; value: string }[];
  overwrite?: boolean;
};

// Used for get()
export type ObjectValue = DeepMutable<
  ContractFunctionReturnType<typeof bucketManagerABI, AbiStateMutability, "getObject">
>;

// Used for list()
export type ListResult = DeepMutable<
  ContractFunctionReturnType<typeof bucketManagerABI, AbiStateMutability, "listBuckets">
>;

// Used for query()
export type QueryResult = DeepMutable<
  ContractFunctionReturnType<typeof bucketManagerABI, AbiStateMutability, "queryObjects">
>;

// Note: this emits raw cbor bytes, so we need to decode it to get the bucket address
export type CreateBucketEvent = Required<
  GetEventArgs<typeof bucketManagerABI, "CreateBucket", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketResult = {
  owner: Address;
  bucket: Address;
};

// Used for add()
export type AddObjectResult = Required<
  GetEventArgs<typeof bucketManagerABI, "AddObject", { IndexedOnly: false }>
>;

// Used for delete()
export type DeleteObjectResult = Required<
  GetEventArgs<typeof bucketManagerABI, "DeleteObject", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketParams = Extract<
  ContractFunctionArgs<typeof bucketManagerABI, AbiStateMutability, "createBucket">,
  readonly [Address, readonly { key: string; value: string }[]]
>;

// Used for get()
export type GetObjectParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "getObject"
>;

// Used for delete()
export type DeleteObjectParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "deleteObject"
>;

// Used for query()
export type QueryObjectsParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "queryObjects"
>;

// Used for add()
export type AddObjectFullParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "addObject"
>;

// Used for add()
export type AddObjectParams = DeepMutable<
  Extract<
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
  >
>;

export class BucketManager {
  private fileHandler: FileHandler;
  client: HokuClient;
  contract: GetContractReturnType<typeof bucketManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const chainId = client.publicClient?.chain?.id;
    if (!chainId) {
      throw new Error("Client chain ID not found");
    }
    const deployedBucketManagerAddress = (bucketManagerAddress as Record<number, Address>)[chainId];
    if (!deployedBucketManagerAddress) {
      throw new Error(`No contract address found for chain ID ${chainId}}`);
    }
    this.contract = getContract({
      abi: bucketManagerABI,
      address: contractAddress || deployedBucketManagerAddress,
      client: {
        public: client.publicClient,
        wallet: client.walletClient!,
      },
    });

    // Detect environment and set appropriate handler
    this.fileHandler = typeof process === "undefined" ? webFileHandler : nodeFileHandler;
  }

  getContract(): GetContractReturnType<typeof bucketManagerABI, Client, Address> {
    return this.contract;
  }

  // Create a bucket
  async create(
    owner?: Address,
    metadata?: Record<string, string>
  ): Promise<Result<CreateBucketResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for creating a bucket");
    }
    try {
      const args = [
        owner ?? this.client.walletClient.account.address,
        metadata ? convertMetadataToAbiParams(metadata) : [],
      ] satisfies CreateBucketParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "createBucket",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const { owner: eventOwner, data } = await parseEventFromTransaction<CreateBucketEvent>(
        this.client.publicClient,
        this.contract.abi,
        "CreateBucket",
        hash
      );
      // The first value is the actor's ID, the second is the robust t2 address payload; we don't use the robust address
      // See `CreateExternalReturn`: https://github.com/hokunet/ipc/blob/35abe5f4be2d0dddc9d763ce69bdc4d39a148d0f/fendermint/vm/actor_interface/src/adm.rs#L66
      // We need to decode the actor ID from the CBOR and then convert it to an Ethereum address
      // The actor ID needs to be LEB128 encoded, and the FVM ID address is 1 byte of 0x00 followed by the actor ID
      const decoded = cbor.decode(data);
      const actorId = decoded[0] as number;
      const bucket = actorIdToMaskedEvmAddress(actorId);
      return { meta: { tx }, result: { owner: eventOwner, bucket } };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new CreateBucketError(error.message);
      }
      throw new UnhandledBucketError(`Failed to create bucket: ${error}`);
    }
  }

  // List buckets
  async list(owner: Address, blockNumber?: bigint): Promise<Result<ListResult>> {
    try {
      const result = (await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "listBuckets",
        args: [owner],
        blockNumber,
      })) as ListResult;
      return { result };
    } catch (error) {
      // Check if includes: `failed to resolve actor for address`; this means the account doesn't exist
      if (
        error instanceof ContractFunctionExecutionError &&
        error.message.includes("failed to resolve actor for address")
      ) {
        return { result: [] };
      }
      throw new UnhandledBucketError(`Failed to list buckets: ${error}`);
    }
  }

  // Add an object to a bucket inner
  // TODO: should this be private and used internally by `add`
  async addInner(bucket: Address, addParams: AddObjectParams): Promise<Result<AddObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    const args = [bucket, addParams] satisfies AddObjectFullParams;
    const { request } = await this.client.publicClient.simulateContract({
      address: this.contract.address,
      abi: this.contract.abi,
      functionName: "addObject",
      args,
      account: this.client.walletClient.account,
    });
    const hash = await this.client.walletClient.writeContract(request);
    const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
    const {
      owner,
      bucket: eventBucket,
      key,
    } = await parseEventFromTransaction<AddObjectResult>(
      this.client.publicClient,
      this.contract.abi,
      "AddObject",
      hash
    );
    return { meta: { tx }, result: { owner, bucket: eventBucket, key } };
  }

  // Add an object to a bucket
  async add(
    bucket: Address,
    key: string,
    file: string | File | Uint8Array,
    options?: AddOptions
  ): Promise<Result<AddObjectResult>> {
    if (!this.client.walletClient || !this.client.walletClient.chain) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    const metadata = options?.metadata ?? [];
    const { data, contentType } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadata.push({ key: "content-type", value: contentType });
    }
    const { nodeId: source } = await getObjectsNodeInfo(LOCALNET_OBJECT_API_URL);
    const iroh = await createIrohNode();
    const { hash, size } = await stageDataToIroh(iroh, data);

    // TTL of zero is interpreted by Solidity wrappers as null
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const addParams: AddObjectParams = {
      source,
      key,
      blobHash: hash,
      recoveryHash: "",
      size,
      ttl,
      metadata,
      overwrite: options?.overwrite ?? false,
    };
    const irohNode = await irohNodeTypeToObjectsApiNodeInfo(iroh);
    const { metadataHash } = await callObjectsApiAddObject(
      LOCALNET_OBJECT_API_URL,
      this.client,
      this.contract.address,
      bucket,
      addParams,
      irohNode
    );
    addParams.recoveryHash = metadataHash;
    return await this.addInner(bucket, addParams);
  }

  // Delete an object from a bucket
  async delete(bucket: Address, key: string): Promise<Result<DeleteObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const args = [bucket, key] satisfies DeleteObjectParams;
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "deleteObject",
        args,
        account: this.client.walletClient.account,
      });
      const hash = await this.client.walletClient.writeContract(request);
      const tx = await this.client.publicClient.waitForTransactionReceipt({ hash });
      const {
        owner,
        bucket: eventBucket,
        key: eventKey,
      } = await parseEventFromTransaction<DeleteObjectResult>(
        this.client.publicClient,
        this.contract.abi,
        "DeleteObject",
        hash
      );
      return { meta: { tx }, result: { owner, bucket: eventBucket, key: eventKey } };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        // Check for specific error messages
        if (error.message.includes("object not found")) {
          throw new ObjectNotFound(bucket, key);
        }
      }
      throw new UnhandledBucketError(`Failed to delete object: ${error}`);
    }
  }

  // Get an object from a bucket, without downloading it
  async getObjectValue(
    bucket: Address,
    key: string,
    blockNumber?: bigint
  ): Promise<Result<ObjectValue>> {
    try {
      const args = [bucket, key] satisfies GetObjectParams;
      const { blobHash, recoveryHash, size, expiry, metadata } =
        await this.client.publicClient.readContract({
          abi: this.contract.abi,
          address: this.contract.address,
          functionName: "getObject",
          args,
          blockNumber,
        });
      if (!blobHash) {
        throw new ObjectNotFound(bucket, key);
      }
      const result = { blobHash, recoveryHash, size, expiry, metadata: [...metadata] };
      return { result };
    } catch (error) {
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
    range?: { start?: number; end?: number },
    blockNumber?: bigint
  ): Promise<Uint8Array> {
    try {
      const stream = await downloadBlob(LOCALNET_OBJECT_API_URL, bucket, key, range, blockNumber);
      const chunks: Uint8Array[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Combine all chunks into a single Uint8Array
      const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
      const data = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        data.set(chunk, offset);
        offset += chunk.length;
      }
      return data;
    } catch (error) {
      if (error instanceof InvalidValue || error instanceof ObjectNotFound) {
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
    blockNumber?: bigint
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      return downloadBlob(LOCALNET_OBJECT_API_URL, bucket, key, range, blockNumber);
    } catch (error) {
      if (error instanceof InvalidValue || error instanceof ObjectNotFound) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to download object: ${error}`);
    }
  }

  // Query objects in a bucket
  async query(
    bucket: Address,
    prefix: string,
    delimiter: string = "/",
    startKey: string = "",
    limit: number = 100,
    blockNumber?: bigint
  ): Promise<Result<QueryResult>> {
    try {
      const args = [
        bucket,
        prefix,
        delimiter,
        startKey,
        BigInt(limit),
      ] satisfies QueryObjectsParams;
      const { objects, commonPrefixes, nextKey } = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "queryObjects",
        args,
        blockNumber,
      });
      const result = {
        objects: objects.map(({ key, state }) => ({
          key,
          state: {
            blobHash: state.blobHash,
            size: state.size,
            metadata: [...state.metadata],
          },
        })),
        commonPrefixes: [...commonPrefixes],
        nextKey,
      };
      return { result };
    } catch (error) {
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
