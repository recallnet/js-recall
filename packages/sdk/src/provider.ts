import { Address } from "viem";

import {
  BucketNotFound,
  InvalidValue,
  ObjectNotAvailable,
  UnhandledBucketError,
} from "./errors.js";
import { SnakeToCamelCase, snakeToCamel } from "./utils.js";

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
export type ObjectsApiUploadResponse =
  SnakeToCamelCase<ObjectsApiUploadResponseRaw>;

export type ObjectsApiFormData = {
  data: Uint8Array;
  size: bigint;
  contentType?: string;
};

export function createObjectsFormData({
  data,
  size,
  contentType,
}: ObjectsApiFormData): FormData {
  const formData = new FormData();
  formData.append("size", size.toString());
  formData.append(
    "data",
    new File([data as BlobPart], "blob", {
      type: contentType ?? "application/octet-stream",
    }),
  );
  return formData;
}

export async function getObjectsNodeInfo(
  objectsProviderUrl: string,
): Promise<ObjectsApiNodeInfo> {
  const response = await fetch(`${objectsProviderUrl}/v1/node`);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Objects API error: ${error.message}`);
  }
  const json = await response.json();
  return snakeToCamel(json) as ObjectsApiNodeInfo;
}

export async function callObjectsApiAddObject(
  objectsProviderUrl: string,
  data: Uint8Array,
  size: bigint,
  contentType?: string,
): Promise<ObjectsApiUploadResponse> {
  const formData = createObjectsFormData({
    data,
    size,
    contentType,
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
  blockNumber?: bigint,
): Promise<ReadableStream<Uint8Array>> {
  const headers: HeadersInit = {};
  if (range) {
    headers.Range = `bytes=${range.start ?? ""}-${range.end ?? ""}`;
  }
  const url = new URL(`${objectsProviderUrl}/v1/objects/${bucket}/${key}`);
  if (blockNumber !== undefined) {
    url.searchParams.set("height", blockNumber.toString());
  }
  const response = await fetch(url, {
    headers,
  });
  if (!response.ok) {
    const error = await response.json();
    if (
      error.message.includes("actor does not exist") ||
      error.message.includes("bucket get error")
    ) {
      throw new BucketNotFound(bucket);
    }
    if (error.message.includes("is not available")) {
      const blobHash =
        error.message.match(/object\s+(.*)\s+is not available/)?.[1] ?? "";
      throw new ObjectNotAvailable(key, blobHash);
    }
    if (error.message.includes("invalid range header")) {
      throw new InvalidValue(
        `Invalid range: ${range?.start ?? ""}-${range?.end ?? ""}`,
      );
    }
    throw new UnhandledBucketError(
      `Failed to download object: ${error.message}`,
    );
  }
  if (!response.body) {
    throw new UnhandledBucketError("Failed to download object: no body");
  }

  return response.body;
}
