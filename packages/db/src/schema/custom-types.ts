import { customType, numeric, varchar } from "drizzle-orm/pg-core";

/**
 * PG column for amount of tokens in wei (BigInt representation)
 */
export function tokenAmount(name: string) {
  return numeric(name, { precision: 78, scale: 0, mode: "bigint" });
}

/**
 * PG column for a blockchain address
 */
export function blockchainAddress(name: string) {
  return varchar(name, { length: 50 });
}

export const bytea = customType<{
  data: Uint8Array | Buffer; // what your app uses
  driverData: Buffer; // what node-postgres returns
  notNull: false;
  default: false;
}>({
  dataType: () => "bytea",
  toDriver: (v) => (v instanceof Buffer ? v : Buffer.from(v)),
  fromDriver: (v) => v, // Buffer
});
