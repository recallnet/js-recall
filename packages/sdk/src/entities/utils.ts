import { Abi, GetEventArgs, Hash, parseEventLogs, PublicClient, TransactionReceipt } from "viem";

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

// Remove `readonly` from all properties of an object (via viem contract types)
export type DeepMutable<T> = T extends readonly (infer U)[]
  ? DeepMutable<U>[]
  : T extends object
    ? { -readonly [P in keyof T]: DeepMutable<T[P]> }
    : T;

export async function parseEventFromTransaction<T extends GetEventArgs<Abi, string>>(
  client: PublicClient,
  abi: Abi,
  eventName: string,
  hash: Hash
): Promise<T> {
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
  obj: T extends Record<string, unknown> ? T : never
): SnakeToCamelCase<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  ) as SnakeToCamelCase<T>;
}

export function camelToSnake<T>(
  obj: T extends Record<string, unknown> ? T : never
): SnakeToCamelCase<T> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [
      key.replace(/([A-Z])/g, "_$1").toLowerCase(),
      // Recursively transform nested objects
      value && typeof value === "object" && !Array.isArray(value)
        ? camelToSnake(value as Record<string, unknown>)
        : value,
    ])
  ) as SnakeToCamelCase<T>;
}
