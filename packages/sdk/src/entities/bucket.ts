import { AddressActor, base32, cbor } from "@hokunet/fvm";
import { blake3 } from "@noble/hashes/blake3";
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
import { DeepMutable, parseEventFromTransaction, type Result } from "./utils.js";

// {
//   "node_id": "r4md6oqwcbb2my4jkjqnah2yhvcvyjhefdmdruoiknawuedg2kja",
//   "info": {
//     "relay_url": "https://use1-1.relay.iroh.network./",
//     "direct_addresses": [
//       "74.66.17.39:11204",
//       "192.168.1.137:11204",
//       "[2603:7000:4c3b:3f4e::155b]:11205",
//       "[2603:7000:4c3b:3f4e:84a:cef9:e7b2:cf5b]:11205",
//       "[2603:7000:4c3b:3f4e:d32:a9a6:6f39:7814]:11205"
//     ]
//   }
// }

type IrohNode = {
  node_id: string;
  info: {
    relay_url: string;
    direct_addresses: string[];
  };
};

type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

// Utility type to transform all properties of an object
type SnakeToCamelCase<T> = {
  [K in keyof T as SnakeToCamel<string & K>]: T[K];
};

// Original API response type
type RawObjectsApiResponse = {
  hash: string;
  metadata_hash: string;
};

function snakeToCamel<T>(obj: T extends Record<string, unknown> ? T : never): SnakeToCamelCase<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  ) as SnakeToCamelCase<T>;
}

// Transformed type with camelCase
type ObjectsApiResponse = SnakeToCamelCase<RawObjectsApiResponse>;

// TODO: emulates `@wagmi/cli` generated constants
export const bucketManagerAddress = {
  2938118273996536: "0x4c74c78B3698cA00473f12eF517D21C65461305F", // TODO: testnet; outdated contract deployment, but keeping here
  4362550583360910: "0xe4EB561155AFCe723bB1fF8606Fbfe9b28d5d38D", // TODO: localnet; we need to make this deterministic
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
export type CreateBucketEvent = Required<
  GetEventArgs<typeof bucketManagerABI, "CreateBucket", { IndexedOnly: false }>
>;

// Used for create()
export type CreateBucketResult = {
  owner: Address;
  bucket: string;
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

async function getObjectsNodeInfo(): Promise<IrohNode> {
  const response = await fetch("http://localhost:8001/v1/node");
  const json = await response.json();
  return json;
}

async function createIrohNode(): Promise<Iroh> {
  const iroh = await Iroh.memory();
  return iroh;
}

async function irohNodeToExpectedFormat(node: Iroh): Promise<IrohNode> {
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
  return { node_id: nodeId, info: { relay_url: relayUrl, direct_addresses: addresses } };
}

async function uploadToIroh(iroh: Iroh, data: Uint8Array): Promise<BlobAddOutcome> {
  const dataArray: number[] = Array.from(data);
  return await iroh.blobs.addBytes(dataArray);
}

// Function to convert hex string to byte array (Uint8Array)
function hexToBytes(hex: string) {
  if (hex.startsWith("0x")) {
    hex = hex.slice(2);
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// Function to encode a Uint8Array to Base64
function encodeToBase64(byteArray: Uint8Array) {
  let binary = "";
  for (let i = 0; i < byteArray.length; i++) {
    binary += String.fromCharCode(byteArray[i]);
  }
  return btoa(binary);
}

export async function callObjectsApiAddObject(
  bucketManager: BucketManager,
  bucket: string,
  params: AddObjectParams,
  irohNode: IrohNode
): Promise<ObjectsApiResponse> {
  try {
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
    // METHOD_ADD_OBJECT = 3518119203
    // (bool success, bytes memory data) = address(CALL_ACTOR_ADDRESS).delegatecall(
    //   abi.encode(uint64(method_num), value, static_call ? READ_ONLY_FLAG : DEFAULT_FLAG, codec, raw_request, actor_address)
    // );
    // let calldata = ethers_core::abi::encode(&[
    //     ethers_core::abi::Token::Uint(ethers_core::types::U256::from(
    //         fendermint_actor_bucket::Method::AddObject as u64,
    //     )), // method_num
    //     ethers_core::abi::Token::Uint(0.into()), // value
    //     ethers_core::abi::Token::Uint(0x00000000.into()), // static call
    //     ethers_core::abi::Token::Uint(fvm_ipld_encoding::CBOR.into()), // cbor codec
    //     ethers_core::abi::Token::Bytes(params.to_vec()), // params
    //     ethers_core::abi::Token::Uint(store.id().unwrap().into()), // target contract ID address
    // ]);
    // CBOR_CODEC = 0x51
    const request = await bucketManager.client.walletClient.prepareTransactionRequest({
      from,
      to: bucketManager.contract.address,
      value: 0n,
      data: encodedData,
      chain: bucketManager.client.walletClient.chain,
      account: bucketManager.client.walletClient.account!,
    });
    const signedTransaction = await bucketManager.client.walletClient.signTransaction(request);
    const byteArray = hexToBytes(signedTransaction);
    const base64MsgRaw = encodeToBase64(byteArray);
    const base64Msg = base64MsgRaw.replace(/\+/g, "-").replace(/\//g, "_");

    const source = JSON.stringify(irohNode);
    const formData = new FormData();
    formData.append("chain_id", chainId.toString());
    formData.append("msg", base64Msg);
    formData.append("hash", params.blobHash);
    formData.append("size", params.size.toString());
    formData.append("source", source);
    const response = await fetch("http://localhost:8001/v1/objects", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Objects API error: ${error.message}`);
    }
    const json = await response.json();
    return snakeToCamel(json) as ObjectsApiResponse;
  } catch (error) {
    console.error("Error calling objects API add object", error);
    throw error;
  }
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
      // First value is the actor's ID, second is the robust t2 address payload
      const decoded = cbor.decode(data);
      const filAddressBytes = decoded[1];
      const bucket = AddressActor.fromBytes(filAddressBytes);
      return { meta: { tx }, result: { owner: eventOwner, bucket: bucket.toString() } };
    } catch (error) {
      if (error instanceof ContractFunctionExecutionError) {
        throw new CreateBucketError(error.message);
      }
      throw new UnhandledBucketError(`Failed to create bucket: ${error}`);
    }
  }

  // List buckets
  async list(owner: Hex, blockNumber?: bigint): Promise<Result<ListResult>> {
    const data = await this.client.publicClient.readContract({
      abi: this.contract.abi,
      address: this.contract.address,
      functionName: "listBuckets",
      args: [owner],
      blockNumber,
    });
    // Convert readonly `metadata` to mutable type
    const result = data.map((item) => ({
      ...item,
      metadata: [...item.metadata],
    }));
    return { result };
  }

  // Add an object to a bucket
  // TODO: this should be private and used internally by addFile
  async add(bucket: string, addParams: AddObjectParams): Promise<Result<AddObjectResult>> {
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
    bucket: string,
    key: string,
    file: string | File | Uint8Array,
    options?: AddOptions
  ): Promise<Result<AddObjectResult>> {
    const metadata = options?.metadata ?? [];
    const { data, contentType } = await this.fileHandler.readFile(file);
    if (contentType) {
      metadata.push({ key: "content-type", value: contentType });
    }
    const { node_id: source } = await getObjectsNodeInfo();
    // const blobHash = bytesToBlobHash(data);
    const iroh = await createIrohNode();
    const { hash, size } = await uploadToIroh(iroh, data);

    // TTL of zero is interpreted by Solidity wrappers as null; auto-renewed
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
    const irohNode = await irohNodeToExpectedFormat(iroh);
    const { metadataHash } = await callObjectsApiAddObject(this, bucket, addParams, irohNode);
    addParams.recoveryHash = metadataHash;
    return await this.add(bucket, addParams);
  }

  // Delete an object from a bucket
  async delete(bucket: string, key: string): Promise<Result<DeleteObjectResult>> {
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
  async get(bucket: string, key: string, blockNumber?: bigint): Promise<Result<ObjectValue>> {
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
    bucket: string,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint
  ): Promise<Uint8Array> {
    try {
      const {
        result: { size },
      } = await this.get(bucket, key, blockNumber);
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
    bucket: string,
    key: string,
    range?: { start: number; end?: number },
    blockNumber?: bigint
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      const {
        result: { size },
      } = await this.get(bucket, key, blockNumber);
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
  ): Promise<Result<QueryResult>> {
    try {
      const args = [
        bucket,
        prefix,
        delimiter,
        BigInt(offset),
        BigInt(limit),
      ] satisfies QueryObjectsParams;
      const { objects, commonPrefixes } = await this.client.publicClient.readContract({
        abi: this.contract.abi,
        address: this.contract.address,
        functionName: "queryObjects",
        args,
        blockNumber,
      });
      const result = {
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

function convertMetadataToAbiParams(
  value: Record<string, string>
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}
