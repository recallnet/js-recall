// Forked & converted to use `bigint` & `Uint8Array`
// Source: https://gitlab.com/mjbecze/leb128
import { Stream } from "./common.js";

/**
 * Reads an unsigned LEB128 encoded integer from a stream
 * @param stream - stream to read from
 * @returns unsigned LEB128 encoded integer
 */
export function read(stream: Stream): string {
  return readBigInt(stream).toString();
}

/**
 * Reads an unsigned LEB128 encoded integer from a stream
 * @param stream - stream to read from
 * @returns unsigned LEB128 encoded integer
 */
export function readBigInt(stream: Stream): bigint {
  let num = 0n;
  let shift = 0;
  let byte: number;

  while (true) {
    byte = stream.read(1)[0]!;
    num |= BigInt(byte & 0x7f) << BigInt(shift);
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  return num;
}

/**
 * Writes an unsigned LEB128 encoded integer to a stream
 * @param number - number to write
 * @param stream - stream to write to
 */
export function write(number: number | string | bigint, stream: Stream): void {
  let num = BigInt(number);
  while (true) {
    const i = Number(num & 0x7fn);
    num >>= 7n;
    if (num === 0n) {
      stream.write(new Uint8Array([i]));
      break;
    } else {
      stream.write(new Uint8Array([i | 0x80]));
    }
  }
}

/**
 * LEB128 encodes an integer
 * @param num - number to encode
 * @returns LEB128 encoded Uint8Array
 */
export function encode(num: number | string | bigint): Uint8Array {
  const stream = new Stream();
  write(num, stream);
  return stream.buffer;
}

/**
 * decodes a LEB128 encoded integer
 * @param buffer - buffer to decode
 * @returns decoded string
 */
export function decode(buffer: Uint8Array): string {
  const stream = new Stream(buffer as Uint8Array<ArrayBuffer>);
  return read(stream);
}
