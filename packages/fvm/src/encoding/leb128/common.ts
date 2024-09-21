// Forked & converted to use `bigint` & `Uint8Array`
// Source: https://gitlab.com/mjbecze/leb128
/**
 * Stream class for reading and writing LEB128 encoded data
 */
export class Stream {
  buffer: Uint8Array;
  _bytesRead: number;

  constructor(buf = Uint8Array.from([])) {
    this.buffer = buf;
    this._bytesRead = 0;
  }

  read(size: number) {
    const data = this.buffer.slice(0, size);
    this.buffer = this.buffer.slice(size);
    this._bytesRead += size;
    return data;
  }

  write(buf: Uint8Array) {
    this.buffer = Uint8Array.from([...this.buffer, ...buf]);
  }
}
