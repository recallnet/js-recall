import { ResultAsync, errAsync, ok } from "neverthrow";
import { Logger } from "pino";

import { BlockchainAddressAsU8A } from "@recallnet/db/coders";
import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { UserRepository } from "@recallnet/db/repositories/user";
import { Database } from "@recallnet/db/types";

import { BoostAwardService } from "./boost-award.service.js";
import { errorToMessage } from "./lib/error-to-message.js";

/**
 * Parameters for boosting an agent
 */
export type BoostAgentParams = {
  userId: string;
  competitionId: string;
  agentId: string;
  amount: bigint;
  idemKey: Buffer;
};

/**
 * A single boost allocation record for a competition
 */
export type CompetitionBoost = {
  userId: string;
  wallet: string;
  agentId: string;
  agentName: string;
  agentHandle: string;
  amount: bigint;
  createdAt: string;
};

/**
 * Paginated response for competition boosts
 */
export type CompetitionBoostsResult = {
  items: CompetitionBoost[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
};

export interface BoostServiceConfig {
  boost: {
    noStakeBoostAmount?: bigint;
  };
}

/**
 * Boost Service
 * Manages boost operations including validation and business logic
 */
export class BoostService {
  private boostRepository: BoostRepository;
  // TODO: Consider if we want to depend on the competition repository
  // or the competition service. Likewise for user repository vs user service.
  private competitionRepository: CompetitionRepository;
  private userRepository: UserRepository;
  private boostAwardService: BoostAwardService;
  private database: Database;
  private noStakeBoostAmount: bigint;
  private logger: Logger;

  constructor(
    boostRepository: BoostRepository,
    competitionRepository: CompetitionRepository,
    userRepository: UserRepository,
    boostAwardService: BoostAwardService,
    database: Database,
    config: BoostServiceConfig,
    logger: Logger,
  ) {
    this.boostRepository = boostRepository;
    this.competitionRepository = competitionRepository;
    this.userRepository = userRepository;
    this.boostAwardService = boostAwardService;
    this.database = database;
    this.noStakeBoostAmount =
      config.boost.noStakeBoostAmount ?? 1000000000000000000000n;
    this.logger = logger;
  }

  claimBoost(userId: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.increase({
        userId,
        competitionId,
        amount: this.noStakeBoostAmount,
        idemKey: Buffer.from(`claim-${userId}-${competitionId}`),
        meta: { description: "Claim non-stake boost" },
      }),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).andThen((result) => {
      if (result.type === "noop") {
        return errAsync({ type: "AlreadyClaimedBoost" } as const);
      }
      return ok(result);
    });
  }

  claimStakedBoost(userId: string, wallet: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.database.transaction(async (tx) => {
        const stakes = await this.boostRepository.unawardedStakes(
          wallet,
          competitionId,
          tx,
        );
        if (stakes.length === 0) {
          return {
            type: "noop" as const,
            balance: 0n,
            idemKey: Buffer.from(`claim-staked-${userId}-${competitionId}`),
          };
        }

        const competition =
          await this.competitionRepository.findById(competitionId);
        if (!competition) {
          throw new Error("Competition not found");
        }

        if (!competition.boostStartDate || !competition.boostEndDate) {
          throw new Error("Competition missing boost dates");
        }

        let balance = 0n;
        for (const stake of stakes) {
          const result = await this.boostAwardService.awardForStake(
            {
              id: stake.id,
              wallet: wallet,
              amount: stake.amount,
              stakedAt: stake.stakedAt,
              canUnstakeAfter: stake.canUnstakeAfter,
            },
            {
              id: competition.id,
              boostStartDate: competition.boostStartDate,
              boostEndDate: competition.boostEndDate,
            },
            tx,
          );

          // We should get "applied" for all
          if (result.type === "noop") {
            return {
              type: "noop" as const,
              balance: 0n,
              idemKey: Buffer.from(`claim-staked-${userId}-${competitionId}`),
            };
          }

          balance = result.balanceAfter;
        }

        return {
          type: "claimed" as const,
          balance: balance,
          idemKey: Buffer.from(`claim-staked-${userId}-${competitionId}`),
        };
      }),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).andThen((result) => {
      if (result.type === "noop") {
        return errAsync({ type: "AlreadyClaimedBoost" } as const);
      }
      return ok(result);
    });
  }

  /**
   * Get user boost balance for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns A result containing the user's boost balance or an error
   */
  getUserBoostBalance(userId: string, competitionId: string) {
    return ResultAsync.fromPromise(
      // Get the user to validate they exist
      this.userRepository.findById(userId),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).andThen((user) => {
      if (!user) {
        return errAsync({ type: "UserNotFound" } as const);
      }
      return ResultAsync.fromPromise(
        this.boostRepository.userBoostBalance({
          userId: user.id,
          competitionId,
        }),
        (err) =>
          ({
            type: "RepositoryError",
            message: errorToMessage(err),
          }) as const,
      );
    });
  }

  /**
   * Get agent boost totals for a competition
   * @param competitionId The competition ID
   * @returns A result containing a map of agent IDs to their boost totals or an error
   */
  getAgentBoostTotals(competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.agentBoostTotals({
        competitionId,
      }),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    );
  }

  /**
   * Get user boosts for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns A result containing a map of agent IDs to boost amounts or an error
   */
  getUserBoosts(userId: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.userBoosts({
        userId,
        competitionId,
      }),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    );
  }

  /**
   * Boost an agent in a competition
   * @param params The boost parameters
   * @returns The result of the boost operation
   */
  boostAgent(params: BoostAgentParams) {
    const { userId, competitionId, agentId, amount, idemKey } = params;
    return ResultAsync.fromPromise(
      this.userRepository.findById(userId),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    )
      .andThen((user) => {
        if (!user) {
          return errAsync({ type: "UserNotFound" } as const);
        }
        return ResultAsync.fromPromise(
          this.competitionRepository.findById(competitionId),
          (err) =>
            ({
              type: "RepositoryError",
              message: errorToMessage(err),
            }) as const,
        ).map((competition) => ({ user, competition }));
      })
      .andThen(({ competition }) => {
        if (!competition) {
          return errAsync({ type: "CompetitionNotFound" } as const);
        }
        // Validate boost dates are set
        if (
          competition.boostStartDate == null ||
          competition.boostEndDate == null
        ) {
          return errAsync({
            type: "CompetitionMissingBoostDates",
          } as const);
        }
        // Validate we're within the boost time window
        const now = new Date();
        if (
          !(competition.boostStartDate < now && now < competition.boostEndDate)
        ) {
          return errAsync({
            type: "OutsideCompetitionBoostWindow",
          } as const);
        }
        return ResultAsync.fromPromise(
          this.boostRepository.boostAgent({
            userId,
            agentId,
            competitionId,
            amount,
            idemKey,
          }),
          (err) =>
            ({
              type: "RepositoryError",
              message: errorToMessage(err),
            }) as const,
        ).andThen((result) => {
          if (result.type === "noop") {
            return errAsync({ type: "AlreadyBoostedAgent" } as const);
          }
          return ok(result);
        });
      });
  }

  /**
   * Get paginated boost allocations for a competition
   * @param competitionId The competition ID
   * @param limit Maximum number of records to return
   * @param offset Number of records to skip
   * @returns A result containing paginated boost allocations or an error
   */
  getCompetitionBoosts(
    competitionId: string,
    { limit, offset }: { limit: number; offset: number },
  ): ResultAsync<
    CompetitionBoostsResult,
    { type: "RepositoryError"; message: string }
  > {
    return ResultAsync.fromPromise(
      Promise.all([
        this.boostRepository.competitionBoosts(
          { competitionId, limit, offset },
          undefined,
        ),
        this.boostRepository.countCompetitionBoosts(competitionId, undefined),
      ]),
      (err) =>
        ({
          type: "RepositoryError",
          message: errorToMessage(err),
        }) as const,
    ).map(([items, total]) => {
      const mappedItems: CompetitionBoost[] = items.map((item) => ({
        userId: item.userId,
        wallet: BlockchainAddressAsU8A.decode(item.wallet),
        agentId: item.agentId,
        agentName: item.agentName,
        agentHandle: item.agentHandle,
        amount: item.amount,
        createdAt: item.createdAt.toISOString(),
      }));

      return {
        items: mappedItems,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total,
        },
      };
    });
  }
}
