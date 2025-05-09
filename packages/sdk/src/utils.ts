import {
  Abi,
  Address,
  GetEventArgs,
  Hash,
  PublicClient,
  TransactionReceipt,
  parseEventLogs,
} from "viem";
import { Hex, hexToBytes } from "viem";

import { AddressId } from "@recallnet/fvm/address";
import { base32ToHex as fvmBase32ToHex, leb128 } from "@recallnet/fvm/utils";

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

export function hexToBase64(hex: Hex, safeUrl: boolean = true): string {
  const bytes = hexToBytes(hex);
  return bytesToBase64(bytes, safeUrl);
}

/**
 * Convert a base32 string to a hex string
 * @param value - The base32 string to convert
 * @returns The hex string
 */
export function base32ToHex(value: string): Hex {
  return fvmBase32ToHex(value) as Hex;
}

// Utility type to transform snake_case to camelCase
export type SnakeToCamel<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<SnakeToCamel<U>>}`
  : S;

// Utility type to transform all properties of an object
export type SnakeToCamelCase<T> =
  T extends Array<infer U>
    ? Array<SnakeToCamelCase<U>>
    : T extends object
      ? {
          [K in keyof T as SnakeToCamel<string & K>]: SnakeToCamelCase<T[K]>;
        }
      : T;

export function snakeToCamel<T>(
  obj: T extends Record<string, unknown> ? T : never,
): SnakeToCamelCase<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ]),
  ) as SnakeToCamelCase<T>;
}

export function camelToSnake<T>(
  obj: T extends Record<string, unknown> ? T : never,
): SnakeToCamelCase<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/([A-Z])/g, "_$1").toLowerCase(),
      // Recursively transform nested objects
      value && typeof value === "object" && !Array.isArray(value)
        ? camelToSnake(value as Record<string, unknown>)
        : value,
    ]),
  ) as SnakeToCamelCase<T>;
}

// TODO: figure out if this is the right pattern for file handling
export interface FileHandler {
  readFile: (input: string | File | Uint8Array) => Promise<{
    data: Uint8Array;
    contentType?: string;
    size: bigint;
  }>;
}

export const createFileHandler = (): FileHandler => ({
  async readFile(input: string | File | Uint8Array): Promise<{
    data: Uint8Array;
    contentType?: string;
    size: bigint;
  }> {
    // Browser File
    if (typeof File !== "undefined" && input instanceof File) {
      const data = new Uint8Array(await input.arrayBuffer());
      return {
        data,
        contentType: input.type,
        size: BigInt(input.size),
      };
    }

    // Node.js file path
    if (typeof input === "string") {
      if (typeof window !== "undefined") {
        throw new Error("File paths are not supported in browser environment");
      }
      // Webpack/Next.js friendly dynamic import
      const fs = await import(/* webpackIgnore: true */ "fs/promises").catch(
        () => null,
      );
      if (!fs) {
        throw new Error("File system not available in this environment");
      }
      const data = await fs.readFile(input);
      const { fileTypeFromBuffer } = await import("file-type");
      const type = await fileTypeFromBuffer(data);
      return {
        data: new Uint8Array(data),
        contentType: type?.mime || "application/octet-stream",
        size: BigInt(data.length),
      };
    }

    // Uint8Array (works in both environments)
    const data =
      input instanceof Uint8Array
        ? input
        : new Uint8Array(await input.arrayBuffer());
    return {
      data,
      contentType: "application/octet-stream",
      size: BigInt(data.length),
    };
  },
});

/**
 * Metadata for read or write operations (currently only `tx` is used, via write operations)
 * @param hash Transaction hash, if the operation was a write
 */
export interface Metadata {
  tx?: TransactionReceipt;
}

// Generic type for read operations, returns the data
export type Result<T = unknown> = {
  result: T;
  meta?: Metadata;
};

// Parse event from transaction
export async function parseEventFromTransaction<
  T extends GetEventArgs<Abi, string>,
>(client: PublicClient, abi: Abi, eventName: string, hash: Hash): Promise<T> {
  const receipt = await client.waitForTransactionReceipt({
    hash,
  });
  const logs = parseEventLogs({
    abi,
    logs: receipt.logs,
  });
  const log = logs.find((log) => log.eventName === eventName);
  if (!log) {
    throw new Error(`Event ${eventName} not found`);
  }
  return log.args as T;
}

// Convert object to solidity `Metadata` struct abi params
export function convertMetadataToAbiParams(
  value: Record<string, string>,
): { key: string; value: string }[] {
  return Object.entries(value).map(([key, value]) => ({ key, value }));
}

// Convert solidity `Metadata` struct to normal javascript object
export function convertAbiMetadataToObject(
  metadata: readonly { key: string; value: string }[],
): Record<string, string> {
  return metadata.reduce(
    (acc, { key, value }) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );
}

// Convert actor ID to masked EVM address
export function actorIdToMaskedEvmAddress(actorId: number): Address {
  const actorIdBytes = new Uint8Array([
    0x00,
    ...leb128.unsigned.encode(actorId),
  ]);
  // Note: `fromBytes` assumes the network prefix is Testnet, but we'll need to handle Mainnet, too
  return AddressId.fromBytes(actorIdBytes).toEthAddressHex() as Address;
}
