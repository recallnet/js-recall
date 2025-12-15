import { customType, numeric } from "drizzle-orm/pg-core";

/**
 * PG column for amount of tokens in wei (BigInt representation)
 */
export function tokenAmount(name: string) {
  return numeric(name, { precision: 78, scale: 0, mode: "bigint" });
}

export const ethAddress = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return "varchar(42)";
  },
  toDriver(value: string): string {
    return value.toLowerCase();
  },
  fromDriver(value: string): string {
    return value;
  },
});

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
