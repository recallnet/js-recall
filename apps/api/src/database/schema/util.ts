import { numeric, varchar } from "drizzle-orm/pg-core";

/**
 * PG column for amount of tokens in humanese
 */
export function tokenAmount(name: string) {
  return numeric(name, { precision: 30, scale: 18, mode: "number" });
}

/**
 * PG column for a blockchain address
 */
export function blockchainAddress(name: string) {
  return varchar(name, { length: 50 });
}
