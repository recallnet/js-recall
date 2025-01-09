import { AddressId } from "@hokunet/fvm";
import { BlobAddOutcome, Iroh } from "@number0/iroh";
import { Address, encodeFunctionData } from "viem";
import { bucketManagerABI } from "../abis.js";
import { HokuClient } from "../client.js";
import { AddObjectFullParams, AddObjectParams } from "../entities/bucket.js";
import { InvalidValue, ObjectNotAvailable, UnhandledBucketError } from "../entities/errors.js";
import { camelToSnake, hexToBase64, snakeToCamel, SnakeToCamelCase } from "./utils.js";

export type ObjectsApiNodeInfoRaw = {
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

export function createObjectsFormData({
  chainId,
  msg,
  hash,
  size,
  source,
}: ObjectsApiFormData): FormData {
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

export async function getObjectsNodeInfo(objectsProviderUrl: string): Promise<ObjectsApiNodeInfo> {
  const response = await fetch(`${objectsProviderUrl}/v1/node`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Objects API error: ${error.message}`);
  }
  const json = await response.json();
  return snakeToCamel(json) as ObjectsApiNodeInfo;
}

export async function createIrohNode(): Promise<Iroh> {
  const iroh = await Iroh.memory();
  return iroh;
}

export async function irohNodeTypeToObjectsApiNodeInfo(node: Iroh): Promise<ObjectsApiNodeInfo> {
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

export async function stageDataToIroh(iroh: Iroh, data: Uint8Array): Promise<BlobAddOutcome> {
  const dataArray: number[] = Array.from(data);
  return await iroh.blobs.addBytes(dataArray);
}

export async function callObjectsApiAddObject(
  objectsProviderUrl: string,
  client: HokuClient,
  bucketManagerAddress: Address,
  bucket: Address,
  params: AddObjectParams,
  source: ObjectsApiNodeInfo
): Promise<ObjectsApiUploadResponse> {
  if (!client.walletClient) {
    throw new Error("Wallet client is not initialized for adding an object");
  }
  const wallet = client.walletClient;
  const args = [bucket, params] satisfies AddObjectFullParams;
  const encodedData = encodeFunctionData({
    abi: bucketManagerABI,
    functionName: "addObject",
    args,
  });

  // Create a signed evm transaction:
  const from = wallet.account?.address;
  if (!from) {
    throw new Error("Wallet client is not initialized for adding an object");
  }
  const request = await client.walletClient.prepareTransactionRequest({
    from,
    to: bucketManagerAddress,
    value: 0n,
    data: encodedData,
    chain: wallet.chain!,
    account: wallet.account!,
  });
  const signedTransaction = await wallet.signTransaction(request);
  const msg = hexToBase64(signedTransaction);

  const formData = createObjectsFormData({
    chainId: wallet.chain!.id,
    msg,
    hash: params.blobHash,
    size: params.size,
    source,
  });
  const response = await fetch(`${objectsProviderUrl}/v1/objects`, {
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
export async function downloadBlob(
  objectsProviderUrl: string,
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
  const url = new URL(`${objectsProviderUrl}/v1/objects/${bucketIdAddress}/${key}`);
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
