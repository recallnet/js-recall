import { Hex, bytesToHex, hexToBytes } from "viem";

import * as base32 from "./base32.js";

/**
 * Convert a bigint to a Uint8Array
 * @param value - The bigint to convert
 * @param pad - Whether to pad the result to 2 bytes
 * @returns The Uint8Array
 */
export function bigintToUint8Array(
  value: string | bigint | number,
  pad: boolean = false,
): Uint8Array {
  if (value === 0 || value === "0" || value === 0n) return new Uint8Array(0);

  const num = BigInt(value);
  let hex = num.toString(16);

  if (hex.length % 2 === 1) hex = `0${hex}`;
  if (pad) hex = `00${hex}`;

  return hexToBytes(`0x${hex}`);
}

/**
 * Convert a string, number, bigint, or Uint8Array to a bigint. Copied from ethers.js.
 * @param value - The value to convert
 * @returns The bigint
 */
export function toBigInt(value: string | number | bigint | Uint8Array): bigint {
  const Nibbles = "0123456789abcdef";
  if (value instanceof Uint8Array) {
    let result = "0x0";
    for (const v of value) {
      result += Nibbles[v >> 4];
      result += Nibbles[v & 0x0f];
    }
    return BigInt(result);
  }

  switch (typeof value) {
    case "bigint":
      return value;
    case "number":
      return BigInt(value);
    case "string":
      try {
        if (value === "") {
          throw new Error("empty string");
        }
        if (value[0] === "-" && value[1] !== "-") {
          return -BigInt(value.substring(1));
        }
        return BigInt(value);
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      } catch (e: any) {
        throw new Error(`invalid BigNumberish string: ${e.message}`);
      }
  }
}

/**
 * Convert a base32 string to a hex string
 * @param value - The base32 string to convert
 * @param withPrefix - Whether to include the 0x prefix (default: true)
 * @returns The hex string
 */
export function base32ToHex(value: string, withPrefix: boolean = true): string {
  const bytes = base32.decode(value);
  const hex = bytesToHex(bytes);
  return withPrefix ? hex : hex.slice(2);
}

/**
 * Convert a hex string to a base32 string
 * @param value - The hex string to convert
 * @param withPrefix - Whether to include the 0x prefix (default: true)
 * @returns The base32 string
 */
export function hexToBase32(value: string, withPrefix: boolean = true): string {
  const bytes = hexToBytes(withPrefix ? (value as Hex) : `0x${value}`);
  return base32.encode(bytes);
}

/**
 * Compare two Uint8Arrays
 * @param a - The first Uint8Array
 * @param b - The second Uint8Array
 * @returns The result of the comparison
 */
export function compareUint8Arrays(a: Uint8Array, b: Uint8Array): number {
  const minLength = Math.min(a.length, b.length);

  for (let i = 0; i < minLength; i++) {
    const aByte = a[i]!;
    const bByte = b[i]!;

    if (aByte < bByte) {
      return -1;
    }

    if (aByte > bByte) {
      return 1;
    }
  }

  if (a.length > b.length) {
    return 1;
  }

  if (a.length < b.length) {
    return -1;
  }

  return 0;
}
