import { decode as decodeCbor, encode as encodeCbor } from "cborg";
import { Hex, hexToBytes } from "viem";

export function decode(data: Uint8Array | string) {
  if (typeof data === "string") {
    // Assume cbor format, and check if string has leading hex `0x` character
    if (data.startsWith("0x")) {
      data = hexToBytes(data as Hex);
    } else {
      data = hexToBytes(`0x${data}` as Hex);
    }
  }
  return decodeCbor(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encode(data: any) {
  return encodeCbor(data);
}
