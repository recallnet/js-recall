import { AddressId, cbor, leb128 } from "@hokunet/fvm";
import { BlobAddOutcome, Iroh } from "@number0/iroh";
import {
  AbiStateMutability,
  Address,
  Client,
  ContractFunctionArgs,
  ContractFunctionExecutionError,
  ContractFunctionReturnType,
  encodeFunctionData,
  getContract,
  GetContractReturnType,
  GetEventArgs,
  Hex,
  hexToBytes,
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
import {
  camelToSnake,
  DeepMutable,
  parseEventFromTransaction,
  type Result,
  snakeToCamel,
  type SnakeToCamelCase,
} from "./utils.js";

type ObjectsApiNodeInfoRaw = {
  node_id: string;
  info: {
    relay_url: string;
    direct_addresses: string[];
  };
};

export type ObjectsApiNodeInfo = SnakeToCamelCase<ObjectsApiNodeInfoRaw>;

// Original API response type
type ObjectsApiUploadResponseRaw = {
  hash: string;
  metadata_hash: string;
};

// Transformed type with camelCase
export type ObjectsApiUploadResponse = SnakeToCamelCase<ObjectsApiUploadResponseRaw>;

type ObjectsApiFormData = {
  chainId: number;
  msg: string;
  hash: string;
  size: bigint;
  source: ObjectsApiNodeInfo;
};

function createObjectsFormData({ chainId, msg, hash, size, source }: ObjectsApiFormData): FormData {
  const formData = new FormData();
  const formatted = {
    chain_id: chainId.toString(),
    msg,
    hash,
    size: size.toString(),
    source: JSON.stringify(camelToSnake(source)),
  };
  Object.entries(formatted).forEach(([key, value]) => {
    formData.append(key, value as string);
  });
  return formData;
}

// TODO: emulates `@wagmi/cli` generated constants
export const bucketManagerAddress = {
  2481632: "0x4c74c78B3698cA00473f12eF517D21C65461305F", // TODO: testnet; outdated contract deployment, but keeping here
  248163216: "0xf7Cd8fa9b94DB2Aa972023b379c7f72c65E4De9D", // TODO: localnet; we need to make this deterministic
  1942764459484029: "0x2Cff47A442d1E5B8beCbb104Cf8ca659d09BDB77", // TODO: devnet; we need to make this deterministic
} as const;

/// The minimum epoch duration a blob can be stored.
export const MIN_TTL = 3600n; // one hour

// Internally used for add()
// export type AddParams = {
//   source: string;
//   key: string;
//   blobHash: string;
//   recoveryHash: string;
//   size: bigint;
//   ttl: bigint;
//   metadata: { key: string; value: string }[];
//   overwrite: boolean;
// };

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
type CreateBucketParams = Extract<
  ContractFunctionArgs<typeof bucketManagerABI, AbiStateMutability, "createBucket">,
  readonly [Address, readonly { key: string; value: string }[]]
>;

// Used for get()
type GetObjectParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "getObject"
>;

// Used for delete()
type DeleteObjectParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "deleteObject"
>;

// Used for query()
type QueryObjectsParams = ContractFunctionArgs<
  typeof bucketManagerABI,
  AbiStateMutability,
  "queryObjects"
>;

// Used for add()
type AddObjectFullParams = ContractFunctionArgs<
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

async function getObjectsNodeInfo(): Promise<ObjectsApiNodeInfo> {
  const response = await fetch("http://localhost:8001/v1/node");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Objects API error: ${error.message}`);
  }
  const json = await response.json();
  return snakeToCamel(json) as ObjectsApiNodeInfo;
}

async function createIrohNode(): Promise<Iroh> {
  const iroh = await Iroh.memory();
  return iroh;
}

async function irohNodeTypeToObjectsApiNodeInfo(node: Iroh): Promise<ObjectsApiNodeInfo> {
  const irohNet = node.net;
  const nodeId = await irohNet.nodeId();
  const nodeAddr = await irohNet.nodeAddr();
  const addresses = nodeAddr.addresses;
  if (!addresses) {
    throw new Error("No addresses found for node");
  }
  const relayUrl = nodeAddr.relayUrl;
  if (!relayUrl) {
    throw new Error("No relay URL found for node");
  }
  return { nodeId, info: { relayUrl, directAddresses: addresses } };
}

async function uploadToIroh(iroh: Iroh, data: Uint8Array): Promise<BlobAddOutcome> {
  const dataArray: number[] = Array.from(data);
  return await iroh.blobs.addBytes(dataArray);
}

// Function to encode a Uint8Array to Base64
function bytesToBase64(bytes: Uint8Array, safeUrl: boolean = true): string {
  const binary = String.fromCodePoint(...bytes);

  // TODO: Hack to handle web vs nodejs environments
  let base64: string;
  if (typeof globalThis.btoa === "function") {
    base64 = globalThis.btoa(binary);
  } else if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(binary, "binary").toString("base64");
  } else {
    throw new Error("Environment not supported for Base64 encoding");
  }
  return safeUrl ? base64.replace(/\+/g, "-").replace(/\//g, "_") : base64;
}

function hexToBase64(hex: Hex, safeUrl: boolean = true): string {
  const bytes = hexToBytes(hex);
  return bytesToBase64(bytes, safeUrl);
}

export async function callObjectsApiAddObject(
  bucketManager: BucketManager,
  bucket: Address,
  params: AddObjectParams,
  source: ObjectsApiNodeInfo
): Promise<ObjectsApiUploadResponse> {
  if (!bucketManager.client) {
    throw new Error("Client is not initialized for adding an object");
  }
  // We need to pass multipart form data with the following fields:
  // hash
  // source
  // size
  // msg
  // chain_id
  if (!bucketManager.client.walletClient || !bucketManager.client.walletClient.chain) {
    throw new Error("Wallet client is not initialized for adding an object");
  }
  const chainId = bucketManager.client.walletClient.chain.id;
  const args = [bucket, params] satisfies AddObjectFullParams;
  const encodedData = encodeFunctionData({
    abi: bucketManager.contract.abi,
    functionName: "addObject",
    args,
  });

  // Create a signed evm transaction:
  const from = bucketManager.client.walletClient.account?.address;
  if (!from) {
    throw new Error("Wallet client is not initialized for adding an object");
  }
  const request = await bucketManager.client.walletClient.prepareTransactionRequest({
    from,
    to: bucketManager.contract.address,
    value: 0n,
    data: encodedData,
    chain: bucketManager.client.walletClient.chain,
    account: bucketManager.client.walletClient.account!,
  });
  const signedTransaction = await bucketManager.client.walletClient.signTransaction(request);
  const msg = hexToBase64(signedTransaction);

  const formData = createObjectsFormData({
    chainId,
    msg,
    hash: params.blobHash,
    size: params.size,
    source,
  });
  const response = await fetch("http://localhost:8001/v1/objects", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Objects API error: ${error.message}`);
  }
  const json = await response.json();
  return snakeToCamel(json) as ObjectsApiUploadResponse;
}

// Get a blob from the objects API
async function downloadBlob(
  bucket: Address,
  key: string,
  range?: { start?: number; end?: number },
  blockNumber?: bigint
): Promise<ReadableStream<Uint8Array>> {
  const headers: HeadersInit = {};
  if (range) {
    headers.Range = `bytes=${range.start ?? ""}-${range.end ?? ""}`;
  }
  const bucketIdAddress = AddressId.fromEthAddress(bucket);
  const url = new URL(`http://localhost:8001/v1/objects/${bucketIdAddress}/${key}`);
  if (blockNumber !== undefined) {
    url.searchParams.set("height", blockNumber.toString());
  }
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    const error = await response.json();
    if (error.message.includes("is not available")) {
      const blobHash = error.message.match(/object\s+(.*)\s+is not available/)?.[1] ?? "";
      throw new ObjectNotAvailable(key, blobHash);
    }
    if (error.message.includes("invalid range header")) {
      throw new InvalidValue(`Invalid range: ${range?.start ?? ""}-${range?.end ?? ""}`);
    }
    throw new UnhandledBucketError(`Failed to download object: ${error.message}`);
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

// TODO: figure out if this is the right pattern for file handling for web vs nodejs
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

// TODO: figure out if this is the right pattern for file handling for web vs nodejs
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
      const actorId = decoded[0];
      const actorIdBytes = new Uint8Array([0x00, ...leb128.unsigned.encode(actorId)]);
      // Note: `fromBytes` assumes the network prefix is Testnet, but we'll need to handle Mainnet, too
      const bucket = AddressId.fromBytes(actorIdBytes).toEthAddressHex() as Address;
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
      if (error instanceof ContractFunctionExecutionError) {
        // Check if includes: `failed to resolve actor for address`; this means the account doesn't exist
        if (error.message.includes("failed to resolve actor for address")) {
          return { result: [] };
        }
        throw new BucketNotFound(owner);
      }
      throw new UnhandledBucketError(`Failed to list buckets: ${error}`);
    }
  }

  // Add an object to a bucket
  // TODO: this should be private and used internally by addFile
  async add(bucket: Address, addParams: AddObjectParams): Promise<Result<AddObjectResult>> {
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

  async addFile(
    bucket: Address,
    key: string,
    file: string | File | Uint8Array,
    options?: AddOptions
  ): Promise<Result<AddObjectResult>> {
    const metadata = options?.metadata ?? [];
    const { data, contentType } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadata.push({ key: "content-type", value: contentType });
    }
    const { nodeId: source } = await getObjectsNodeInfo();
    const iroh = await createIrohNode();
    const { hash, size } = await uploadToIroh(iroh, data);

    // TTL of zero is interpreted by Solidity wrappers as null
    const ttl = options?.ttl ?? 0n;
    if (ttl !== 0n && ttl < MIN_TTL) {
      throw new InvalidValue(`TTL must be at least ${MIN_TTL} seconds`);
    }
    const addParams: AddObjectParams = {
      source,
      key,
      blobHash: hash,
      recoveryHash: "", // TODO: Once https://github.com/hokunet/ipc/issues/300 is merged, this'll need to change
      size,
      ttl,
      metadata,
      overwrite: options?.overwrite ?? false,
    };
    const irohNode = await irohNodeTypeToObjectsApiNodeInfo(iroh);
    const { metadataHash } = await callObjectsApiAddObject(this, bucket, addParams, irohNode);
    addParams.recoveryHash = metadataHash;
    return await this.add(bucket, addParams);
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

  // Get an object from a bucket
  async get(bucket: Address, key: string, blockNumber?: bigint): Promise<Result<ObjectValue>> {
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

  async download(
    bucket: Address,
    key: string,
    range?: { start?: number; end?: number },
    blockNumber?: bigint
  ): Promise<Uint8Array> {
    try {
      const stream = await downloadBlob(bucket, key, range, blockNumber);
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

  async downloadStream(
    bucket: Address,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      return downloadBlob(bucket, key, range, blockNumber);
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

function convertMetadataToAbiParams(
  value: Record<string, string>
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}
