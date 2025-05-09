// Forked & converted to use `bigint` & `Uint8Array`
// Source: https://gitlab.com/mjbecze/leb128
import { Stream } from "./common.js";

/**
 * Reads a signed LEB128 encoded integer from a stream
 * @param stream - stream to read from
 * @returns signed LEB128 encoded integer
 */
export function read(stream: Stream): string {
  return readBigInt(stream).toString();
}

/**
 * Reads a signed LEB128 encoded integer from a stream
 * @param stream - stream to read from
 * @returns signed LEB128 encoded integer
 */
export function readBigInt(stream: Stream): bigint {
  let num = 0n;
  let shift = 0;
  let byte: number;

  while (true) {
    byte = stream.read(1)[0]!;
    num |= BigInt(byte & 0x7f) << BigInt(shift);
    shift += 7;
    if ((byte & 0x80) === 0) {
      break;
    }
  }

  // Sign extend if negative
  if ((byte & 0x40) !== 0) {
    num |= ~0n << BigInt(shift);
  }

  return num;
}

/**
 * Writes a signed LEB128 encoded integer to a stream
 * @param number - number to write
 * @param stream - stream to write to
 */
export function write(number: number | string | bigint, stream: Stream): void {
  let num = BigInt(number);
  let more = true;

  while (more) {
    // Extract 7 bits to store
    let byte = Number(num & 0x7fn);
    num >>= 7n;

    // Determine if more bytes are needed
    const isLastByte =
      (num === 0n && (byte & 0x40) === 0) ||
      (num === -1n && (byte & 0x40) !== 0);
    if (isLastByte) {
      more = false; // No more bytes needed
    } else {
      byte |= 0x80; // Set the continuation bit
    }

    // Write byte to stream
    stream.write(new Uint8Array([byte]));
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
