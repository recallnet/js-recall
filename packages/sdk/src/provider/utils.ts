import { Hex, hexToBytes } from "viem";

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
