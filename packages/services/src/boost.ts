import { ResultAsync, errAsync, ok } from "neverthrow";
import { Logger } from "pino";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { UserRepository } from "@recallnet/db/repositories/user";

import { errorToMessage } from "./utils/error-to-message.js";

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
 * Boost Service
 * Manages boost operations including validation and business logic
 */
export class BoostService {
  private boostRepository: BoostRepository;
  // TODO: Consider if we want to depend on the competition repository
  // or the competition service. Likewise for user repository vs user service.
  private competitionRepository: CompetitionRepository;
  private userRepository: UserRepository;
  private nonStakeBoostAmount: bigint;
  private logger: Logger;

  constructor(
    boostRepository: BoostRepository,
    competitionRepository: CompetitionRepository,
    userRepository: UserRepository,
    nonStakeBoostAmount: bigint = 1000000000000000000000n,
    logger: Logger,
  ) {
    this.boostRepository = boostRepository;
    this.competitionRepository = competitionRepository;
    this.userRepository = userRepository;
    this.nonStakeBoostAmount = nonStakeBoostAmount;
    this.logger = logger;
  }

  claimBoost(userId: string, wallet: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.increase({
        userId,
        wallet,
        competitionId,
        amount: this.nonStakeBoostAmount,
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
      .andThen(({ user, competition }) => {
        if (!competition) {
          return errAsync({ type: "CompetitionNotFound" } as const);
        }
        // Validate voting dates are set
        if (
          competition.votingStartDate == null ||
          competition.votingEndDate == null
        ) {
          return errAsync({
            type: "CompetitionMissingVotingDates",
          } as const);
        }
        // Validate we're within the voting time window
        const now = new Date();
        if (
          !(
            competition.votingStartDate < now && now < competition.votingEndDate
          )
        ) {
          return errAsync({
            type: "OutsideCompetitionBoostWindow",
          } as const);
        }
        return ResultAsync.fromPromise(
          this.boostRepository.boostAgent({
            userId,
            wallet: user.walletAddress,
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
}
