import { decode as decodeCbor, encode as encodeCbor } from "cborg";
import { fromString } from "uint8arrays/from-string";

export function decode(data: Uint8Array | string) {
  if (typeof data === "string") {
    // Assume cbor format, and check if string has leading hex `0x` character
    if (data.startsWith("0x")) {
      const hex = data.slice(2);
      data = fromString(hex, "hex");
    } else {
      data = fromString(data, "hex");
    }
  }
  return decodeCbor(data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function encode(data: any) {
  return encodeCbor(data);
}
