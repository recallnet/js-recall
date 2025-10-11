import { eq, inArray } from "drizzle-orm";
import { Logger } from "pino";

import { sanctionedWallets } from "../schema/core/defs.js";
import { SelectSanctionedWallet } from "../schema/core/types.js";
import { Database } from "../types.js";

export class SanctionedWalletRepository {
  readonly #db: Database;
  readonly #logger: Logger;

  constructor(db: Database, logger: Logger) {
    this.#db = db;
    this.#logger = logger;
  }

  /**
   * Check if a wallet address is sanctioned
   * @param address The wallet address to check
   * @returns True if the address is sanctioned, false otherwise
   */
  async isSanctioned(address: string): Promise<boolean> {
    try {
      const normalizedAddress = address.toLowerCase();
      const [result] = await this.#db
        .select()
        .from(sanctionedWallets)
        .where(eq(sanctionedWallets.address, normalizedAddress))
        .limit(1);
      return !!result;
    } catch (error) {
      this.#logger.error({ error }, "Error in isSanctioned");
      throw error;
    }
  }

  /**
   * Add a wallet address to the sanctioned list
   * @param address The wallet address to add (note: lowercased internally before insertion)
   * @returns The created sanctioned wallet record
   */
  async add(address: string): Promise<SelectSanctionedWallet> {
    try {
      const normalizedAddress = address.toLowerCase();
      const [created] = await this.#db
        .insert(sanctionedWallets)
        .values({ address: normalizedAddress })
        .onConflictDoNothing()
        .returning();
      if (created) return created;

      const [existing] = await this.#db
        .select()
        .from(sanctionedWallets)
        .where(eq(sanctionedWallets.address, normalizedAddress))
        .limit(1);
      if (!existing) throw new Error("Failed to add sanctioned wallet");

      return existing;
    } catch (error) {
      this.#logger.error({ error }, "Error in add");
      throw error;
    }
  }

  /**
   * Remove a wallet address from the sanctioned list
   * @param address The wallet address to remove
   * @returns True if a record was deleted, false otherwise
   */
  async remove(address: string): Promise<boolean> {
    try {
      const normalizedAddress = address.toLowerCase();
      const result = await this.#db
        .delete(sanctionedWallets)
        .where(eq(sanctionedWallets.address, normalizedAddress));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      this.#logger.error({ error }, "Error in remove");
      throw error;
    }
  }

  /**
   * Get all sanctioned wallet addresses
   * @returns Array of all sanctioned wallet records
   */
  async getAll(): Promise<SelectSanctionedWallet[]> {
    try {
      return await this.#db.select().from(sanctionedWallets);
    } catch (error) {
      this.#logger.error({ error }, "Error in getAll");
      throw error;
    }
  }

  /**
   * Check if multiple addresses are sanctioned
   * @param addresses Array of wallet addresses to check (note: lowercased internally)
   * @returns Map of normalized address to boolean indicating if sanctioned
   */
  async areSanctioned(addresses: string[]): Promise<Map<string, boolean>> {
    try {
      if (addresses.length === 0) {
        return new Map();
      }

      const normalizedAddresses = addresses.map((addr) => addr.toLowerCase());
      const results = await this.#db
        .select()
        .from(sanctionedWallets)
        .where(inArray(sanctionedWallets.address, normalizedAddresses));

      const sanctionedSet = new Set(results.map((r) => r.address));
      const map = new Map<string, boolean>();

      for (const addr of normalizedAddresses) {
        map.set(addr, sanctionedSet.has(addr));
      }

      return map;
    } catch (error) {
      this.#logger.error({ error }, "Error in areSanctioned");
      throw error;
    }
  }
}
