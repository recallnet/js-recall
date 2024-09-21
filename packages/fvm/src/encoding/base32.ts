// Forked for convenience across multiple packages
// Sources:
// https://github.com/Zondax/izari-filecoin/blob/master/src/utils/base32.ts
// https://github.com/LinusU/base32-decode/blob/master/index.js

const RFC4648 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const RFC4648_HEX = "0123456789ABCDEFGHIJKLMNOPQRSTUV";
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export type base32Variant = "RFC3548" | "RFC4648" | "RFC4648-HEX" | "Crockford";
export type base32Options = { padding: boolean };

/**
 * Encodes a Uint8Array to a base32 string
 * @param data - input Uint8Array to encode
 * @param variant - base32 variant to use
 * @param options - base32 options
 * @returns base32 encoded string
 */
export function encode(
  data: ArrayBuffer,
  variant: base32Variant = "RFC4648",
  options: base32Options = { padding: false }
) {
  options = options || {};
  let alphabet: string, defaultPadding: boolean;

  switch (variant) {
    case "RFC3548":
    case "RFC4648":
      alphabet = RFC4648;
      defaultPadding = true;
      break;
    case "RFC4648-HEX":
      alphabet = RFC4648_HEX;
      defaultPadding = true;
      break;
    case "Crockford":
      alphabet = CROCKFORD;
      defaultPadding = false;
      break;
  }

  if (!alphabet) throw new Error(`Unknown base32 variant: ${variant}`);

  const padding =
    options.padding !== undefined ? options.padding : defaultPadding;
  const view = toDataView(data);

  let bits = 0;
  let value = 0;
  let output = "";
  for (let i = 0; i < view.byteLength; i++) {
    value = (value << 8) | view.getUint8(i);
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  if (padding) {
    while (output.length % 8 !== 0) {
      output += "=";
    }
  }

  return output;
}

/**
 * Decodes a base32 string to a Uint8Array
 * @param input - base32 encoded string to decode
 * @param variant - base32 variant to use
 * @returns decoded Uint8Array
 */
export function decode(input: string, variant: base32Variant = "RFC4648") {
  let alphabet: string;

  switch (variant) {
    case "RFC3548":
    case "RFC4648":
      alphabet = RFC4648;
      input = input.replace(/=+$/, "");
      break;
    case "RFC4648-HEX":
      alphabet = RFC4648_HEX;
      input = input.replace(/=+$/, "");
      break;
    case "Crockford":
      alphabet = CROCKFORD;
      input = input.toUpperCase().replace(/O/g, "0").replace(/[IL]/g, "1");
      break;
    default:
      throw new Error("Unknown base32 variant: " + variant);
  }

  const length = input.length;
  let bits = 0;
  let value = 0;
  let index = 0;
  const output = new Uint8Array(((length * 5) / 8) | 0);
  for (let i = 0; i < length; i++) {
    value = (value << 5) | readChar(alphabet, input[i]);
    bits += 5;

    if (bits >= 8) {
      output[index++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
    }
  }

  return output.buffer;
}

/**
 * Reads a character from the alphabet
 * @param alphabet - alphabet to read from
 * @param char - character to read
 * @returns index of the character in the alphabet
 */
function readChar(alphabet: string, char: string) {
  const idx = alphabet.indexOf(char);
  if (idx === -1) {
    throw new Error("Invalid character found: " + char);
  }

  return idx;
}

/**
 * Converts an ArrayBuffer, Int8Array, Uint8Array, or Uint8ClampedArray to a DataView
 * @param data - input ArrayBuffer, Int8Array, Uint8Array, or Uint8ClampedArray to convert
 * @returns DataView
 */
function toDataView(
  data: ArrayBuffer | Int8Array | Uint8Array | Uint8ClampedArray
) {
  if (
    data instanceof Int8Array ||
    data instanceof Uint8Array ||
    data instanceof Uint8ClampedArray
  )
    return new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (data instanceof ArrayBuffer) return new DataView(data);
  throw new TypeError(
    "Expected `data` to be an ArrayBuffer, Buffer, Int8Array, Uint8Array or Uint8ClampedArray"
  );
}
