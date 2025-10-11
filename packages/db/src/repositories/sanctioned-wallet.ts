import { eq, inArray } from "drizzle-orm";

import { sanctionedWallets } from "../schema/core/defs.js";
import { SelectSanctionedWallet } from "../schema/core/types.js";
import { Database } from "../types.js";

export class SanctionedWalletRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /**
   * Check if a wallet address is sanctioned
   * @param address The wallet address to check (will be normalized to lowercase)
   * @returns True if the address is sanctioned, false otherwise
   */
  async isSanctioned(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();
    const [result] = await this.#db
      .select()
      .from(sanctionedWallets)
      .where(eq(sanctionedWallets.address, normalizedAddress))
      .limit(1);
    return !!result;
  }

  /**
   * Add a wallet address to the sanctioned list
   * @param address The wallet address to add (will be normalized to lowercase)
   * @returns The created sanctioned wallet record
   */
  async add(address: string): Promise<SelectSanctionedWallet> {
    const normalizedAddress = address.toLowerCase();
    const [created] = await this.#db
      .insert(sanctionedWallets)
      .values({ address: normalizedAddress })
      .returning();
    if (!created) {
      throw new Error("Failed to add sanctioned wallet");
    }
    return created;
  }

  /**
   * Remove a wallet address from the sanctioned list
   * @param address The wallet address to remove (will be normalized to lowercase)
   * @returns True if a record was deleted, false otherwise
   */
  async remove(address: string): Promise<boolean> {
    const normalizedAddress = address.toLowerCase();
    const result = await this.#db
      .delete(sanctionedWallets)
      .where(eq(sanctionedWallets.address, normalizedAddress));
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get all sanctioned wallet addresses
   * @returns Array of all sanctioned wallet records
   */
  async getAll(): Promise<SelectSanctionedWallet[]> {
    return await this.#db.select().from(sanctionedWallets);
  }

  /**
   * Check if multiple addresses are sanctioned
   * @param addresses Array of wallet addresses to check (will be normalized to lowercase)
   * @returns Map of normalized address to boolean indicating if sanctioned
   */
  async areSanctioned(addresses: string[]): Promise<Map<string, boolean>> {
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
  }
}
