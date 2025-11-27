import type { Logger } from "pino";

import type { BoostRepository } from "@recallnet/db/repositories/boost";
import type { CompetitionRepository } from "@recallnet/db/repositories/competition";
import type { UserRepository } from "@recallnet/db/repositories/user";
import type { Database, Transaction } from "@recallnet/db/types";

import { checkForeignKeyViolation } from "./lib/error-utils.js";

// Text encoder for idempotency keys
const TEXT_ENCODER = new TextEncoder();

// Validation constraints for bonus boosts
/** Maximum boost amount: 1 quintillion (10^18) */
const MAX_BONUS_BOOST_AMOUNT = 10n ** 18n;
/** Minimum time in the future for expiration: 1 minute in milliseconds */
const MIN_EXPIRATION_FUTURE_TIME_MS = 60 * 1000;
/** Maximum length of meta field when serialized to JSON */
const MAX_BONUS_BOOST_META_LENGTH = 1000;

/**
 * Result of adding a bonus boost
 */
export type AddBoostBonusResult = {
  /** The ID of the created boost */
  boostBonusId: string;
  /** User ID who received the boost */
  userId: string;
  /** Amount of boost awarded */
  amount: bigint;
  /** When the boost expires */
  expiresAt: Date;
  /** Competition IDs where boost was applied */
  appliedToCompetitions: string[];
};

/**
 * Result of revoking a bonus boost
 */
export type RevokeBoostBonusResult = {
  /** The ID of the revoked boost */
  boostBonusId: string;
  /** Whether the boost was successfully revoked */
  revoked: boolean;
  /** Timestamp when the boost was revoked */
  revokedAt: Date;
  /** Competition IDs where the boost was removed from pending */
  removedFromPending: string[];
  /** Competition IDs where the boost was kept (window already open) */
  keptInActive: string[];
};

/**
 * BoostBonusService
 *
 * Manages bonus boost operations including:
 * - Adding bonus boosts to users
 * - Revoking bonus boosts
 * - Applying boosts to eligible competitions
 * - Removing boosts from competitions
 *
 * Key concepts:
 * - **Revocation**: Marks boost as inactive and removes from pending competitions
 * - **Window Check**: Only removes boost if boosting window hasn't opened
 * - **Idempotency**: Uses unique keys to prevent duplicate operations
 * - **Transaction Safety**: All operations are atomic
 */
export class BoostBonusService {
  readonly #db: Database;
  readonly #boostRepository: BoostRepository;
  readonly #competitionRepository: CompetitionRepository;
  readonly #userRepository: UserRepository;
  readonly #logger: Logger;

  constructor(
    database: Database,
    boostRepository: BoostRepository,
    competitionRepository: CompetitionRepository,
    userRepository: UserRepository,
    logger: Logger,
  ) {
    this.#db = database;
    this.#boostRepository = boostRepository;
    this.#competitionRepository = competitionRepository;
    this.#userRepository = userRepository;
    this.#logger = logger;
  }

  /**
   * Revokes a bonus boost.
   *
   * This method:
   * 1. Validates that the boost exists and is currently active
   * 2. Marks the boost as inactive (is_active = false)
   * 3. Sets the revoked_at timestamp
   * 4. Finds all competitions where the boost was applied (via boost_changes)
   * 5. For each competition:
   *    - Checks if boostStartDate and boostEndDate exist
   *    - Checks if boosting window is open (boostStartDate < now < boostEndDate)
   *    - If window hasn't opened: removes boost (decreases balance)
   *    - If window is open: keeps boost (user might have spent it)
   * 6. Uses idempotency key to prevent duplicates: `revokeBonusBoost=${boostBonusId}&competition=${competitionId}`
   *
   * **Error Handling:**
   * - Throws error if boost doesn't exist
   * - Throws error if boost is already revoked (is_active = false)
   * - Logs warning if boost_changes entries are missing (assumes never applied)
   * - Logs warning if competition is missing boost dates (skips that competition)
   * - All operations wrapped in transaction with automatic rollback on failure
   *
   * **Idempotency:**
   * - Uses reverse idempotency key pattern: `revokeBonusBoost=${boostBonusId}&competition=${competitionId}`
   * - Encoded using URLSearchParams and TextEncoder (same pattern as other boost operations)
   * - If same revocation is retried, unique constraint prevents duplicate and returns noop
   *
   * @param boostBonusId - The ID of the bonus boost to revoke
   * @returns Result containing revocation details and affected competitions
   * @throws Error if boost not found or already revoked
   *
   * @example
   * ```typescript
   * const result = await boostBonusService.revokeBoostBonus('boost-uuid');
   * console.log(`Revoked boost ${result.boostBonusId}`);
   * console.log(`Removed from ${result.removedFromPending.length} pending competitions`);
   * console.log(`Kept in ${result.keptInActive.length} active competitions`);
   * ```
   */
  async revokeBoostBonus(
    boostBonusId: string,
  ): Promise<RevokeBoostBonusResult> {
    const executeWithTx = async (transaction: Transaction) => {
      // Step 1: Validate boost exists and is active
      const boost = await this.#boostRepository.findBoostBonusById(
        boostBonusId,
        transaction,
      );

      if (!boost) {
        throw new Error(`Bonus boost with id ${boostBonusId} not found`);
      }

      if (!boost.isActive) {
        throw new Error(
          `Bonus boost with id ${boostBonusId} is already revoked`,
        );
      }

      // Get user to retrieve wallet address
      const user = await this.#userRepository.findById(boost.userId);
      if (!user) {
        throw new Error(`User with id ${boost.userId} not found`);
      }

      // Step 2: Mark boost as inactive and set revoked_at
      const now = new Date();
      const revokedBoost = await this.#boostRepository.updateBoostBonus(
        boostBonusId,
        {
          isActive: false,
          revokedAt: now,
        },
        transaction,
      );

      this.#logger.info(
        { boostBonusId, userId: boost.userId, amount: boost.amount.toString() },
        "Marked bonus boost as revoked",
      );

      // Step 3: Find all competitions where boost was applied
      const boostChanges =
        await this.#boostRepository.findBoostChangesByBoostBonusId(
          boostBonusId,
          transaction,
        );

      if (boostChanges.length === 0) {
        this.#logger.warn(
          { boostBonusId },
          "No boost_changes entries found for this boost - assuming never applied",
        );
        return {
          boostBonusId: revokedBoost.id,
          revoked: true,
          revokedAt: now,
          removedFromPending: [],
          keptInActive: [],
        };
      }

      this.#logger.info(
        { boostBonusId, changeCount: boostChanges.length },
        "Found boost_changes entries for revocation",
      );

      // Step 4: Process each competition - remove boost if window hasn't opened
      const removedFromPending: string[] = [];
      const keptInActive: string[] = [];

      for (const change of boostChanges) {
        const competitionId = change.competitionId;

        // Get competition to check boost window status
        const competition =
          await this.#competitionRepository.findById(competitionId);

        if (!competition) {
          this.#logger.warn(
            { boostBonusId, competitionId },
            "Competition not found during revocation - skipping",
          );
          continue;
        }

        // Check if competition has boost dates set
        if (!competition.boostStartDate || !competition.boostEndDate) {
          this.#logger.warn(
            { boostBonusId, competitionId },
            "Competition missing boost dates - skipping revocation",
          );
          continue;
        }

        // Check if boosting window is currently open
        const windowIsOpen =
          competition.boostStartDate < now && now < competition.boostEndDate;

        if (windowIsOpen) {
          // Window is open - user might have spent boost, can't safely revoke
          this.#logger.info(
            { boostBonusId, competitionId },
            "Boosting window is open - keeping boost (user might have spent it)",
          );
          keptInActive.push(competitionId);
          continue;
        }

        // Window hasn't opened - safe to remove boost
        this.#logger.info(
          { boostBonusId, competitionId },
          "Boosting window not open - removing boost from competition",
        );

        // Create idempotency key for revocation
        const idemKey = TEXT_ENCODER.encode(
          new URLSearchParams({
            revokeBonusBoost: boostBonusId,
            competition: competitionId,
          }).toString(),
        );

        try {
          // Decrease balance - this will noop if already revoked via idempotency
          const result = await this.#boostRepository.decrease(
            {
              userId: boost.userId,
              wallet: user.walletAddress,
              competitionId,
              amount: boost.amount,
              idemKey,
              meta: {
                description: `Revoke bonus boost ${boostBonusId}`,
                boostBonusId,
              },
            },
            transaction,
          );

          if (result.type === "applied") {
            removedFromPending.push(competitionId);
            this.#logger.info(
              {
                boostBonusId,
                competitionId,
                amount: boost.amount.toString(),
                newBalance: result.balanceAfter.toString(),
              },
              "Successfully removed boost from competition",
            );
          } else if (result.type === "noop") {
            this.#logger.warn(
              { boostBonusId, competitionId },
              "Idempotency prevented revocation - already processed",
            );
          }
        } catch (error) {
          // Handle case where competition is deleted between query and revocation
          // FK violations can occur on either:
          // 1. boost_balances.competition_id (when competition is deleted)
          // 2. boost_changes.balance_id (when boost_balances row is cascade-deleted due to competition deletion)
          const constraint = checkForeignKeyViolation(error);
          if (
            constraint?.includes("competition_id") ||
            constraint?.includes("balance_id")
          ) {
            this.#logger.warn(
              { boostBonusId, competitionId },
              "Competition was deleted during boost revocation - skipping",
            );
            continue;
          }
          // Re-throw other errors (don't mask unexpected issues)
          throw error;
        }
      }

      this.#logger.info(
        {
          boostBonusId,
          removedCount: removedFromPending.length,
          keptCount: keptInActive.length,
        },
        "Completed bonus boost revocation",
      );

      return {
        boostBonusId: revokedBoost.id,
        revoked: true,
        revokedAt: now,
        removedFromPending,
        keptInActive,
      };
    };

    return this.#db.transaction(executeWithTx);
  }

  /**
   * Adds a bonus boost to a user and applies it to eligible competitions.
   *
   * **Updating Boosts:**
   * To modify an existing bonus boost (change amount or expiration), admins must:
   * 1. Call `revokeBoostBonus(oldBoostId)` to revoke the existing boost
   * 2. Call `addBoostBonus(...)` with new parameters to create a new boost
   *
   * This two-step approach is intentional - it avoids the complexity of:
   * - Handling amount increases/decreases across multiple competitions
   * - Managing expiration date changes and re-evaluating eligibility
   * - Maintaining audit trails for what changed and when
   *
   * The revoke + add pattern provides clear semantics and maintains data integrity.
   *
   * This method:
   * 1. Validates the input parameters:
   *    - Amount must be > 0 and <= 10^18
   *    - Expiration must be at least 1 minute in the future
   *    - Meta field must be <= 1000 characters when serialized
   *    - Meta field must only contain primitives (string, number, boolean)
   * 2. Finds user by wallet address
   * 3. Creates bonus boost entry in database
   * 4. Applies boost to all eligible competitions (active + pending)
   * 5. Returns created boost and list of competitions where it was applied
   *
   * **Eligibility Criteria for Competitions:**
   * - Competition status is "active" OR "pending"
   * - `competition.boostStartDate < expiresAt` (boost window starts before expiration)
   * - `competition.boostEndDate > now` (boost window hasn't ended yet)
   * - Competition must have `boostStartDate` and `boostEndDate` set
   *
   * **Validation:**
   * - Amount must be > 0 and <= 10^18 (1 quintillion)
   * - Expiration must be at least 1 minute in the future
   * - Meta field must be <= 1000 characters when serialized
   * - Meta field must only contain primitives (no nested objects/arrays)
   *
   * **Error Handling:**
   * - Throws error if user not found
   * - Throws error if amount is invalid
   * - Throws error if expiration is invalid
   * - Throws error if meta is invalid
   * - If competition is deleted between query and application, skips that competition (logs warning)
   * - All operations wrapped in transaction with automatic rollback on failure
   *
   * **Idempotency:**
   * - Uses unique key pattern: `bonusBoost=${boostBonusId}&competition=${competitionId}`
   * - If same boost is applied twice to same competition, second attempt is noop
   *
   * @param wallet - User's wallet address (0x...)
   * @param amount - Amount of boost to award (must be > 0 and <= 10^18)
   * @param expiresAt - When the boost expires (must be at least 1 minute in future)
   * @param createdByAdminId - Optional admin ID who created the boost
   * @param meta - Optional metadata (primitives only, max 1000 chars serialized)
   * @returns Result containing created boost and list of competitions where it was applied
   * @throws Error if validation fails or user not found
   *
   * @example
   * ```typescript
   * const result = await boostBonusService.addBoostBonus(
   *   '0x1234...',
   *   1000000000000000000n, // 1 token
   *   new Date('2025-12-31'),
   *   'admin-uuid',
   *   { source: 'farcaster', campaignId: 'campaign-123' }
   * );
   * console.log(`Created boost ${result.boostBonusId}`);
   * console.log(`Applied to ${result.appliedToCompetitions.length} competitions`);
   * ```
   */
  async addBoostBonus(
    wallet: string,
    amount: bigint,
    expiresAt: Date,
    createdByAdminId?: string,
    meta?: Record<string, unknown>,
  ): Promise<AddBoostBonusResult> {
    const executeWithTx = async (transaction: Transaction) => {
      // Step 1: Validate input parameters
      if (amount <= 0n) {
        throw new Error("Boost amount must be greater than 0");
      }

      if (amount > MAX_BONUS_BOOST_AMOUNT) {
        throw new Error(`Boost amount exceeds maximum allowed value (10^18)`);
      }

      const now = new Date();
      const minExpirationTime = new Date(
        now.getTime() + MIN_EXPIRATION_FUTURE_TIME_MS,
      );
      if (expiresAt < minExpirationTime) {
        throw new Error(
          "Expiration date must be at least 1 minute in the future",
        );
      }

      // Validate meta field
      if (meta) {
        for (const value of Object.values(meta)) {
          const type = typeof value;
          if (
            type !== "string" &&
            type !== "number" &&
            type !== "boolean" &&
            value !== null
          ) {
            throw new Error(
              "Meta field must only contain primitives (string, number, boolean, null)",
            );
          }
        }

        const metaJson = JSON.stringify(meta);
        if (metaJson.length > MAX_BONUS_BOOST_META_LENGTH) {
          throw new Error(
            `Meta field exceeds maximum length of ${MAX_BONUS_BOOST_META_LENGTH} characters`,
          );
        }
      }

      this.#logger.info(
        { wallet, amount: amount.toString(), expiresAt },
        "Starting to add bonus boost",
      );

      // Step 2: Find user by wallet address
      const user = await this.#userRepository.findByWalletAddress(wallet);
      if (!user) {
        throw new Error(`User with wallet ${wallet} not found`);
      }

      this.#logger.info(
        { userId: user.id, wallet },
        "Found user for bonus boost",
      );

      // Step 3: Create bonus boost entry
      const boost = await this.#boostRepository.createBoostBonus(
        {
          userId: user.id,
          amount,
          expiresAt,
          createdByAdminId,
          meta,
        },
        transaction,
      );

      this.#logger.info(
        { boostBonusId: boost.id, userId: user.id, amount: amount.toString() },
        "Created bonus boost entry",
      );

      // Step 4: Apply boost to eligible competitions
      const appliedCompetitions =
        await this.applyBoostBonusToEligibleCompetitions(
          user.id,
          user.walletAddress,
          boost.id,
          amount,
          expiresAt,
          transaction,
        );

      this.#logger.info(
        {
          boostBonusId: boost.id,
          appliedCount: appliedCompetitions.length,
        },
        "Completed adding bonus boost",
      );

      return {
        boostBonusId: boost.id,
        userId: user.id,
        amount,
        expiresAt,
        appliedToCompetitions: appliedCompetitions,
      };
    };

    return this.#db.transaction(executeWithTx);
  }

  /**
   * Cleans up invalid bonus boosts when a competition's boostStartDate is updated.
   *
   * This method is called by CompetitionService when boostStartDate is changed.
   * It finds bonus boosts that are no longer eligible (boostStartDate > expiresAt)
   * and removes them from the competition if it's safe to do so.
   *
   * **When to Remove:**
   * - Competition's boosting window hasn't opened yet (boostStartDate > now)
   * - New boostStartDate > boost.expiresAt (boost window starts after boost expires)
   *
   * **When to Keep:**
   * - Boosting window already opened (boostStartDate < now) - user might have spent boost
   * - Even if new boostStartDate is invalid, we keep boost for safety
   *
   * **Process:**
   * 1. Find all boost_changes entries for this competition with meta.boostBonusId
   * 2. Get unique boost IDs and fetch corresponding boost_bonus entries
   * 3. For each boost where newBoostStartDate > boost.expiresAt:
   *    - Check if previous boosting window already opened
   *    - If not opened: Remove boost (decrease balance)
   *    - If opened: Keep boost (could have been spent)
   * 4. Use idempotency key: `cleanupInvalidBoost=${boostBonusId}&competition=${competitionId}`
   *
   * **Integration:**
   * Called from CompetitionService.updateCompetition() when boostStartDate is updated.
   *
   * @param competitionId - The competition ID where boostStartDate changed
   * @param newBoostStartDate - The new boostStartDate value
   * @param oldBoostStartDate - The previous boostStartDate value (null if not set before)
   * @param tx - Optional transaction (if not provided, creates new transaction)
   * @returns Object containing lists of removed and kept boost IDs
   * @throws Error if competition not found or cleanup fails
   *
   * @example
   * ```typescript
   * // Called when updating competition
   * if (updates.boostStartDate !== undefined) {
   *   await boostBonusService.cleanupInvalidBoostBonusesForCompetition(
   *     competitionId,
   *     updates.boostStartDate,
   *     existingCompetition.boostStartDate,
   *     tx
   *   );
   * }
   * ```
   */
  async cleanupInvalidBoostBonusesForCompetition(
    competitionId: string,
    newBoostStartDate: Date,
    oldBoostStartDate: Date | null,
    tx?: Transaction,
  ): Promise<{
    removedBoostIds: string[];
    keptBoostIds: string[];
  }> {
    const executeWithTx = async (transaction: Transaction) => {
      const now = new Date();
      const removedBoostIds: string[] = [];
      const keptBoostIds: string[] = [];

      this.#logger.info(
        {
          competitionId,
          newBoostStartDate,
          oldBoostStartDate,
        },
        "Starting cleanup of invalid bonus boosts for competition",
      );

      // Can't safely remove boosts if window already opened
      if (
        (oldBoostStartDate && oldBoostStartDate < now) ||
        newBoostStartDate < now
      ) {
        this.#logger.info(
          { competitionId, oldBoostStartDate, newBoostStartDate },
          "Boosting window already opened - keeping all boosts for safety",
        );
        return {
          removedBoostIds: [],
          keptBoostIds: [],
        };
      }

      // Step 1: Find all boost_changes entries for this competition with meta.boostBonusId
      const boostChanges =
        await this.#boostRepository.findBoostChangesByCompetitionId(
          competitionId,
          transaction,
        );

      if (boostChanges.length === 0) {
        this.#logger.debug(
          { competitionId },
          "No bonus boosts found for competition - nothing to cleanup",
        );
        return {
          removedBoostIds: [],
          keptBoostIds: [],
        };
      }

      this.#logger.info(
        { competitionId, boostChangeCount: boostChanges.length },
        "Found boost_changes entries for cleanup evaluation",
      );

      // Step 2: Get unique boost bonus IDs
      const boostBonusIds = [
        ...new Set(
          boostChanges
            .map((change) => change.meta?.boostBonusId as string | undefined)
            .filter((id): id is string => id !== undefined),
        ),
      ];

      if (boostBonusIds.length === 0) {
        this.#logger.debug(
          { competitionId },
          "No boost_changes entries have boostBonusId in meta - nothing to cleanup",
        );
        return {
          removedBoostIds: [],
          keptBoostIds: [],
        };
      }

      // Step 3: Fetch boost_bonus entries
      const boosts = await this.#boostRepository.findBoostBonusesByIds(
        boostBonusIds,
        transaction,
      );

      this.#logger.info(
        { competitionId, boostCount: boosts.length },
        "Retrieved bonus boost entries for cleanup evaluation",
      );

      // Step 4: Process each boost - remove if invalid
      for (const boost of boosts) {
        const boostBonusId = boost.id;

        // Check if boost is now invalid: newBoostStartDate >= boost.expiresAt
        // Using >= because if they're equal, window opens when boost expires (invalid)
        const isInvalid = newBoostStartDate >= boost.expiresAt;

        if (!isInvalid) {
          this.#logger.debug(
            {
              boostBonusId,
              competitionId,
              newBoostStartDate,
              expiresAt: boost.expiresAt,
            },
            "Boost still valid after boostStartDate change - keeping",
          );
          keptBoostIds.push(boostBonusId);
          continue;
        }

        // Boost is now invalid - remove it
        this.#logger.info(
          {
            boostBonusId,
            competitionId,
            newBoostStartDate,
            expiresAt: boost.expiresAt,
          },
          "Boost now invalid (boostStartDate >= expiresAt) - removing from competition",
        );

        // Get user to retrieve wallet address
        const user = await this.#userRepository.findById(boost.userId);
        if (!user) {
          this.#logger.warn(
            { boostBonusId, userId: boost.userId },
            "User not found during boost cleanup - skipping",
          );
          continue;
        }

        // Create idempotency key for cleanup
        const idemKey = TEXT_ENCODER.encode(
          new URLSearchParams({
            cleanupInvalidBoost: boostBonusId,
            competition: competitionId,
          }).toString(),
        );

        try {
          // Decrease balance
          const result = await this.#boostRepository.decrease(
            {
              userId: boost.userId,
              wallet: user.walletAddress,
              competitionId,
              amount: boost.amount,
              idemKey,
              meta: {
                description: `Cleanup invalid bonus boost ${boostBonusId} (boostStartDate changed)`,
                boostBonusId,
              },
            },
            transaction,
          );

          if (result.type === "applied") {
            removedBoostIds.push(boostBonusId);
            this.#logger.info(
              {
                boostBonusId,
                competitionId,
                amount: boost.amount.toString(),
                newBalance: result.balanceAfter.toString(),
              },
              "Successfully removed invalid boost from competition",
            );
          } else if (result.type === "noop") {
            this.#logger.warn(
              { boostBonusId, competitionId },
              "Idempotency prevented cleanup - already processed",
            );
          }
        } catch (error) {
          // Handle case where competition is deleted during cleanup
          const constraint = checkForeignKeyViolation(error);
          if (constraint?.includes("competition_id")) {
            this.#logger.warn(
              { boostBonusId, competitionId },
              "Competition was deleted during boost cleanup - skipping",
            );
            continue;
          }
          // Re-throw other errors (don't mask unexpected issues)
          throw error;
        }
      }

      this.#logger.info(
        {
          competitionId,
          removedCount: removedBoostIds.length,
          keptCount: keptBoostIds.length,
        },
        "Completed cleanup of invalid bonus boosts",
      );

      return {
        removedBoostIds,
        keptBoostIds,
      };
    };

    // If transaction provided, use it; otherwise create new transaction
    if (tx) {
      return executeWithTx(tx);
    } else {
      return this.#db.transaction(executeWithTx);
    }
  }

  /**
   * Applies a bonus boost to all eligible competitions.
   *
   * This is a helper method called by `addBoostBonus` to apply the boost
   * to all competitions that meet the eligibility criteria.
   *
   * **Eligibility Criteria:**
   * - Competition status is "active" OR "pending"
   * - `competition.boostStartDate < expiresAt` (boost window starts before expiration)
   * - `competition.boostEndDate > now` (boost window hasn't ended yet)
   * - Competition must have `boostStartDate` and `boostEndDate` set
   *
   * **Idempotency:**
   * - Uses unique key pattern: `bonusBoost=${boostBonusId}&competition=${competitionId}`
   * - If same boost is applied twice, second attempt is noop
   *
   * **Error Handling:**
   * - If competition is deleted between query and application, skips that competition (logs warning)
   * - If competition is missing boost dates, skips that competition (logs warning)
   * - Continues processing remaining competitions even if one fails
   *
   * @param userId - User ID who owns the boost
   * @param wallet - User's wallet address
   * @param boostBonusId - ID of the bonus boost to apply
   * @param amount - Amount of boost to award
   * @param expiresAt - When the boost expires
   * @param tx - Transaction to use for database operations
   * @returns Array of competition IDs where boost was applied
   *
   * @private
   */
  private async applyBoostBonusToEligibleCompetitions(
    userId: string,
    wallet: string,
    boostBonusId: string,
    amount: bigint,
    expiresAt: Date,
    tx: Transaction,
  ): Promise<string[]> {
    const now = new Date();
    const appliedCompetitions: string[] = [];

    // Find active and pending competitions (limited to 1000 for safety)
    const activeComps = await this.#competitionRepository.findByStatus({
      status: "active",
      params: { sort: "createdAt", limit: 1000, offset: 0 },
    });
    const pendingComps = await this.#competitionRepository.findByStatus({
      status: "pending",
      params: { sort: "createdAt", limit: 1000, offset: 0 },
    });

    const competitions = [
      ...activeComps.competitions,
      ...pendingComps.competitions,
    ];

    this.#logger.info(
      { boostBonusId, competitionCount: competitions.length },
      "Found competitions to check for boost eligibility",
    );

    for (const competition of competitions) {
      const competitionId = competition.id;

      // Check if competition has boost dates set
      if (!competition.boostStartDate || !competition.boostEndDate) {
        this.#logger.warn(
          { boostBonusId, competitionId },
          "Competition missing boost dates - skipping",
        );
        continue;
      }

      // Check eligibility criteria - eligibility is determined by boost window dates only
      const boostStartDateEligible = competition.boostStartDate < expiresAt;
      const windowNotEnded = competition.boostEndDate > now;

      if (!boostStartDateEligible) {
        this.#logger.debug(
          { boostBonusId, competitionId },
          "Competition boost window starts after boost expires - skipping",
        );
        continue;
      }

      if (!windowNotEnded) {
        this.#logger.debug(
          { boostBonusId, competitionId },
          "Competition boost window already ended - skipping",
        );
        continue;
      }

      // Competition is eligible - apply boost
      this.#logger.info(
        { boostBonusId, competitionId, status: competition.status },
        "Applying bonus boost to eligible competition",
      );

      try {
        // Create idempotency key
        const idemKey = TEXT_ENCODER.encode(
          new URLSearchParams({
            bonusBoost: boostBonusId,
            competition: competitionId,
          }).toString(),
        );

        // Increase balance
        const result = await this.#boostRepository.increase(
          {
            userId,
            wallet,
            competitionId,
            amount,
            idemKey,
            meta: {
              description: `Bonus boost ${boostBonusId}`,
              boostBonusId,
            },
          },
          tx,
        );

        if (result.type === "applied") {
          appliedCompetitions.push(competitionId);

          this.#logger.info(
            {
              boostBonusId,
              competitionId,
              amount: amount.toString(),
              newBalance: result.balanceAfter.toString(),
            },
            "Successfully applied boost to competition",
          );
        } else if (result.type === "noop") {
          this.#logger.warn(
            { boostBonusId, competitionId },
            "Idempotency prevented duplicate application",
          );
        }
      } catch (error) {
        // Handle case where competition is deleted between query and application
        // FK violations can occur on either:
        // 1. boost_balances.competition_id (when competition is deleted)
        // 2. boost_changes.balance_id (when boost_balances row is cascade-deleted due to competition deletion)
        const constraint = checkForeignKeyViolation(error);
        if (
          constraint?.includes("competition_id") ||
          constraint?.includes("balance_id")
        ) {
          this.#logger.warn(
            { boostBonusId, competitionId },
            "Competition was deleted during boost application - skipping",
          );
          continue;
        }
        // Re-throw other errors (don't mask unexpected issues)
        throw error;
      }
    }

    return appliedCompetitions;
  }
}
