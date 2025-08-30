/**
 * Generic codec interface for bidirectional type conversions.
 *
 * Purpose:
 * - Encapsulates "encode" (domain → storage/transport) and "decode"
 *   (storage/transport → domain) in a single reusable contract.
 * - Ensures every encoder/decoder pair is bundled and can be passed around
 *   as a unit.
 *
 * Type parameters:
 * - `F`: "from" type — usually the domain-level type (e.g. a string address).
 * - `T`: "to" type — usually the persisted or transport type (e.g. a byte array).
 *
 * Conventions:
 * - `encode(from: F): T` should be deterministic: calling `decode(encode(x))`
 *   must return a canonical representation of `x`.
 * - `decode(to: T): F` should validate its input and throw if malformed.
 *
 * Examples:
 * - `Coder<string, Uint8Array>` for turning `0x…` hex EVM addresses into
 *   Postgres `bytea` columns.
 * - `Coder<Date, number>` for converting JS dates into epoch seconds.
 *
 * Usage:
 * ```ts
 * const coder: Coder<string, Uint8Array> = BlockchainAddressCoder;
 * const bytes = coder.encode("0xabc123...");
 * const addr = coder.decode(bytes);
 * ```
 */
export interface Coder<F, T> {
  encode(from: F): T;
  decode(to: T): F;
}

/**
 * Encodes an EVM address string (`0x` + 40 hex chars) into a 20-byte `Uint8Array` (for Postgres `bytea`),
 * and decodes back into the canonical lowercase hex string.
 *
 * Invariants:
 * - Always returns lowercase hex (no checksum).
 * - Stored as exactly 20 bytes (`Uint8Array.length === 20`).
 */
export const BlockchainAddressAsU8A: Coder<string, Uint8Array> = {
  encode: (address) => {
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`Invalid EVM address: ${address}`);
    }
    const hex = address.replace(/^0x/, "").toLowerCase(); // drop 0x, normalize
    return Buffer.from(hex, "hex");
  },
  decode: (bytes) => {
    if (bytes.length !== 20) {
      throw new Error(
        `Invalid wallet byte length: ${bytes.length}, expected 20`,
      );
    }
    return "0x" + Buffer.from(bytes).toString("hex");
  },
};

/**
 * Codec for Ethereum block hashes (0x-prefixed, 32 bytes).
 *
 * - Encodes a hex string like "0xabc...def" into a 32-byte Uint8Array.
 * - Decodes a 32-byte Uint8Array back into the canonical lowercase hex string.
 */
export const BlockHashCoder: Coder<string, Uint8Array> = {
  encode: (hash) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error(`Invalid block hash: ${hash}`);
    }
    const hex = hash.replace(/^0x/, "").toLowerCase();
    return Buffer.from(hex, "hex");
  },
  decode: (bytes) => {
    if (bytes.length !== 32) {
      throw new Error(
        `Invalid block hash byte length: ${bytes.length}, expected 32`,
      );
    }
    return "0x" + Buffer.from(bytes).toString("hex");
  },
};

/**
 * Codec for Ethereum transaction hashes (0x-prefixed, 32 bytes).
 *
 * - Encodes a tx hash string into a 32-byte Uint8Array.
 * - Decodes a 32-byte Uint8Array back into the canonical lowercase hex string.
 *
 * Invariant: both directions always produce lowercase hex.
 */
export const TxHashCoder: Coder<string, Uint8Array> = {
  encode: (hash) => {
    if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      throw new Error(`Invalid transaction hash: ${hash}`);
    }
    const hex = hash.replace(/^0x/, "").toLowerCase();
    return Buffer.from(hex, "hex");
  },
  decode: (bytes) => {
    if (bytes.length !== 32) {
      throw new Error(
        `Invalid transaction hash byte length: ${bytes.length}, expected 32`,
      );
    }
    return "0x" + Buffer.from(bytes).toString("hex");
  },
};
