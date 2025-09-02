import { numeric, varchar } from "drizzle-orm/pg-core";

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
