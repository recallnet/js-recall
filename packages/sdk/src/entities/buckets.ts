import { AddressActor, base32, cbor } from "@hokunet/fvm";
import { blake3 } from "@noble/hashes/blake3";
import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  getContract,
  GetContractReturnType,
  GetEventArgs,
  Hex,
} from "viem";
import { bucketManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import {
  BucketNotFound,
  CreateBucketError,
  InvalidValue,
  ObjectNotAvailable,
  ObjectNotFound,
  UnhandledBucketError,
} from "./errors.js";
import { DeepMutable, parseEventFromTransaction, type WriteResult } from "./utils.js";

// TODO: emulates `@wagmi/cli` generated constants
export const bucketManagerAddress = {
  2938118273996536: "0x4c74c78B3698cA00473f12eF517D21C65461305F", // TODO: testnet; outdated contract deployment, but keeping here
  4362550583360910: "0x05B4CB126885fb10464fdD12666FEb25E2563B76", // TODO: localnet; we need to make this deterministic
} as const;

/// The minimum epoch duration a blob can be stored.
export const MIN_TTL = 3600n; // one hour

// Internally used for add()
export type AddParams = {
  source: string;
  key: string;
  blobHash: string;
  recoveryHash: string;
  size: bigint;
  ttl: bigint;
  metadata: { key: string; value: string }[];
  overwrite: boolean;
};

// Used for add()
export type AddOptions = {
  ttl?: bigint;
  metadata?: { key: string; value: string }[];
  overwrite?: boolean;
};

// Used for get()
export type ObjectValue = DeepMutable<
  ContractFunctionReturnType<typeof bucketManagerABI, AbiStateMutability, "get">
>;

// Used for list()
export type ListResult = DeepMutable<
  ContractFunctionReturnType<typeof bucketManagerABI, AbiStateMutability, "list">
>;

// Used for list()
// TODO: type inference runs into issues with overloads
export type QueryResult = {
  objects: {
    key: string;
    value: ObjectValue;
  }[];
  commonPrefixes: string[];
};

// Note: this emits raw cbor bytes, so we need to decode it to get the bucket address
export type BucketCreatedEvent = Required<
  GetEventArgs<typeof bucketManagerABI, "BucketCreated", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketResult = {
  owner: Address;
  bucket: string;
};

// Used for add()
export type AddObjectResult = Required<
  GetEventArgs<typeof bucketManagerABI, "ObjectAdded", { IndexedOnly: false }>
>;

// Used for delete()
export type DeleteObjectResult = Required<
  GetEventArgs<typeof bucketManagerABI, "ObjectRemoved", { IndexedOnly: false }>
>;

async function getObjectsSourceNodeId() {
  const response = await fetch("http://localhost:8001/v1/node");
  const json = await response.json();
  return json.node_id;
}

// TODO: this assumes the blob/object content already exists on hoku.
// it *does not* solve for a net-new blob. this requires an FVM message
// to be signed, along with the source, blobHash, size, and chain ID. these
// are then passed to the `v1/objects/` form upload endpoint.
// https://github.com/hokunet/ipc/blob/59ac0a3ccb59a8e9436acd73fc604f4a689da72e/fendermint/app/src/cmd/objects.rs#L88
export function bytesToBlobHash(data: Uint8Array): string {
  const hash = blake3(data);
  const blobHash = base32.encode(hash).toLowerCase();
  return blobHash;
}

// Get a blob from the objects API
async function downloadBlob(
  bucket: string,
  key: string,
  range?: { start: number; end?: number }
): Promise<ReadableStream<Uint8Array>> {
  const headers: HeadersInit = {};
  if (range) {
    headers.Range = `bytes=${range.start}-${range.end ?? ""}`;
  }
  const response = await fetch(`http://localhost:8001/v1/objects/${bucket}/${key}`, { headers });
  if (!response.ok) {
    const error = await response.json();
    if (error.message.includes("is not available")) {
      const blobHash = error.message.match(/object\s+(.*)\s+is not available/)?.[1] ?? "";
      throw new ObjectNotAvailable(key, blobHash);
    }
    throw new UnhandledBucketError(`Failed to download object: ${error}`);
  }
  if (!response.body) {
    throw new UnhandledBucketError("Failed to download object: no body");
  }

  return response.body;
}

// TODO: figure out if this is the right pattern for file handling
interface FileHandler {
  readFile: (input: string | File | Uint8Array) => Promise<{
    data: Uint8Array;
    contentType?: string;
    size: bigint;
  }>;
}

// TODO: figure out if this is the right pattern for file handling
export const nodeFileHandler: FileHandler = {
  async readFile(input) {
    if (typeof input === "string") {
      const fs = await import("node:fs/promises");
      const { fileTypeFromBuffer } = await import("file-type");
      const data = await fs.readFile(input);
      const type = await fileTypeFromBuffer(data);
      return {
        data: new Uint8Array(data),
        contentType: type?.mime,
        size: BigInt(data.length),
      };
    }
    const data = input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
    return {
      data,
      size: BigInt(data.length),
    };
  },
};

// TODO: figure out if this is the right pattern for file handling
export const webFileHandler: FileHandler = {
  async readFile(input) {
    if (input instanceof File) {
      const data = new Uint8Array(await input.arrayBuffer());
      return {
        data,
        contentType: input.type,
        size: BigInt(input.size),
      };
    }
    if (typeof input === "string") {
      throw new Error("File paths are not supported in browser environment");
    }
    return {
      data: input,
      size: BigInt(input.length),
    };
  },
};

export class BucketManager {
  private fileHandler: FileHandler;
  client: HokuClient;
  contract: GetContractReturnType<typeof bucketManagerABI, Client, Address>;

  constructor(client: HokuClient, contractAddress?: Address) {
    this.client = client;
    const deployedBucketManagerAddress = (bucketManagerAddress as Record<number, Address>)[
      client.publicClient?.chain?.id || 0
    ];
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
  async create(owner?: Address): Promise<WriteResult<CreateBucketResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for creating a bucket");
    }
    try {
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "create",
        args: [owner ?? this.client.walletClient.account.address],
        account: this.client.walletClient.account,
      });
      const tx = await this.client.walletClient.writeContract(request);
      const { owner: eventOwner, data } = await parseEventFromTransaction<BucketCreatedEvent>(
        this.client.publicClient,
        this.contract.abi,
        "BucketCreated",
        tx
      );
      // First value is the actor's ID, second is the robust t2 address payload
      const decoded = cbor.decode(data);
      const filAddressBytes = decoded[1];
      const bucket = AddressActor.fromBytes(filAddressBytes);
      return { tx, result: { owner: eventOwner, bucket: bucket.toString() } };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new CreateBucketError(error.message);
      }
      throw new UnhandledBucketError(`Failed to create bucket: ${error}`);
    }
  }

  // List buckets
  async list(owner: Hex, blockNumber?: bigint): Promise<ListResult> {
    const data = await this.client.publicClient.readContract({
      abi: this.contract.abi,
      address: this.contract.address,
      functionName: "list",
      args: [owner],
      blockNumber,
    });
    // Convert readonly `metadata` to mutable type
    return data.map((item) => ({
      ...item,
      metadata: [...item.metadata],
    }));
  }

  // Add an object to a bucket
  // TODO: this should be private and used internally by addFile
  async add(bucket: string, addParams: AddParams): Promise<WriteResult<AddObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    const { request } = await this.client.publicClient.simulateContract({
      address: this.contract.address,
      abi: this.contract.abi,
      functionName: "add",
      args: [bucket, addParams],
      account: this.client.walletClient.account,
    });
    const tx = await this.client.walletClient.writeContract(request);
    const {
      owner,
      bucket: eventBucket,
      key,
    } = await parseEventFromTransaction<AddObjectResult>(
      this.client.publicClient,
      this.contract.abi,
      "ObjectAdded",
      tx
    );
    return { tx, result: { owner, bucket: eventBucket, key } };
  }

  async addFile(
    bucket: string,
    key: string,
    file: string | File | Uint8Array,
    options?: AddOptions
  ): Promise<WriteResult<AddObjectResult>> {
    const metadata = options?.metadata ?? [];
    const { data, contentType, size } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadata.push({ key: "content-type", value: contentType });
    }
    const source = await getObjectsSourceNodeId();
    const blobHash = bytesToBlobHash(data);

    // TTL of zero is interpreted by Solidity wrappers as null; auto-renewed
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const addParams: AddParams = {
      source,
      key,
      blobHash,
      recoveryHash: "",
      size,
      ttl,
      metadata,
      overwrite: options?.overwrite ?? false,
    };
    return await this.add(bucket, addParams);
  }

  // Remove an object from a bucket
  async delete(bucket: string, key: string): Promise<WriteResult<DeleteObjectResult>> {
    if (!this.client.walletClient?.account) {
      throw new Error("Wallet client is not initialized for adding an object");
    }
    try {
      const { request } = await this.client.publicClient.simulateContract({
        address: this.contract.address,
        abi: this.contract.abi,
        functionName: "remove",
        args: [bucket, key],
        account: this.client.walletClient.account,
      });
      const tx = await this.client.walletClient.writeContract(request);
      const {
        owner,
        bucket: eventBucket,
        key: eventKey,
      } = await parseEventFromTransaction<DeleteObjectResult>(
        this.client.publicClient,
        this.contract.abi,
        "ObjectRemoved",
        tx
      );
      return { tx, result: { owner, bucket: eventBucket, key: eventKey } };
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

  // Get an object from a bucket
  async get(bucket: string, key: string, blockNumber?: bigint): Promise<ObjectValue> {
    try {
      const { blobHash, recoveryHash, size, expiry, metadata } =
        await this.client.publicClient.readContract({
          abi: this.contract.abi,
          address: this.contract.address,
          functionName: "get",
          args: [bucket, key],
          blockNumber,
        });
      if (!blobHash) {
        throw new ObjectNotFound(bucket, key);
      }
      return { blobHash, recoveryHash, size, expiry, metadata: [...metadata] };
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

  async download(
    bucket: string,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint
  ): Promise<Uint8Array> {
    try {
      const { size } = await this.get(bucket, key, blockNumber);
      if (range) {
        checkRange(range, size);
      }
      const stream = await downloadBlob(bucket, key, range);
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
      return result;
    } catch (error) {
      if (error instanceof InvalidValue || error instanceof ObjectNotFound) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to download object: ${error}`);
    }
  }

  async downloadStream(
    bucket: string,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      const { size } = await this.get(bucket, key, blockNumber);
      if (range) {
        checkRange(range, size);
      }
      return downloadBlob(bucket, key, range);
    } catch (error) {
      if (error instanceof InvalidValue || error instanceof ObjectNotFound) {
        throw error;
      }
      throw new UnhandledBucketError(`Failed to download object: ${error}`);
    }
  }

  // Query objects in a bucket
  async query(
    bucket: string,
    prefix: string,
    delimiter: string = "/",
    offset: number = 0,
    limit: number = 100,
    blockNumber?: bigint
  ): Promise<QueryResult> {
    try {
      const { objects, commonPrefixes } = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "query",
        args: [bucket, prefix, delimiter, BigInt(offset), BigInt(limit)],
        blockNumber,
      });
      return {
        objects: objects.map(({ key, value }) => ({
          key,
          value: {
            blobHash: value.blobHash,
            recoveryHash: value.recoveryHash,
            size: value.size,
            expiry: value.expiry,
            metadata: [...value.metadata],
          },
        })),
        commonPrefixes: [...commonPrefixes],
      };
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

function checkRange(range: { start: number; end?: number }, size: bigint) {
  const endPosition = range.end ?? size - 1n;
  if (
    range.start < 0 ||
    range.start > size - 1n ||
    (range.end && range.start > range.end) ||
    (range.end !== undefined && (range.end < 0 || endPosition > size))
  ) {
    throw new InvalidValue(
      `Range start, end, or both are out of bounds: ${range.start}, ${range.end}`
    );
  }
}
