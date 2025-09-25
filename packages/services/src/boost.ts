import { ResultAsync, errAsync, ok } from "neverthrow";
import { Logger } from "pino";

import { BoostRepository } from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { UserRepository } from "@recallnet/db/repositories/user";

import {
  attoValueToNumberValue,
  valueToAttoBigInt,
} from "./utils/atto-conversions.js";

/**
 * Parameters for boosting an agent
 */
export type BoostAgentParams = {
  userId: string;
  competitionId: string;
  agentId: string;
  amount: number;
  idemKey: Buffer;
};

export enum BoostError {
  UserNotFound,
  RepositoryError,
  CompetitionNotFound,
  CompetitionMissingVotingDates,
  OutsideCompetitionBoostWindow,
  AlreadyClaimedBoost,
  AlreadyBoostedAgent,
}

/**
 * Boost Service
 * Manages boost operations including validation and business logic
 */
export class BoostService {
  private boostRepository: BoostRepository;
  private competitionRepository: CompetitionRepository;
  private userRepository: UserRepository;
  private nonStakeBoostAmount: number;
  private logger?: Logger;

  constructor(
    boostRepository: BoostRepository,
    competitionRepository: CompetitionRepository,
    userRepository: UserRepository,
    nonStakeBoostAmount: number = 1000,
    logger?: Logger,
  ) {
    this.boostRepository = boostRepository;
    this.competitionRepository = competitionRepository;
    this.userRepository = userRepository;
    this.nonStakeBoostAmount = nonStakeBoostAmount;
    this.logger = logger;
  }

  async claimBoost(userId: string, wallet: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.increase({
        userId,
        wallet,
        competitionId,
        amount: valueToAttoBigInt(this.nonStakeBoostAmount),
        idemKey: Buffer.from(`claim-${userId}-${competitionId}`),
        meta: { description: "Claim non-stake boost" },
      }),
      () => BoostError.RepositoryError as const,
    )
      .andThen((result) => {
        if (result.type === "noop") {
          return errAsync(BoostError.AlreadyClaimedBoost as const);
        }
        return ok(result);
      })
      .map((result) => ({
        ...result,
        balanceAfter: attoValueToNumberValue(result.balanceAfter),
      }));
  }

  /**
   * Get user boost balance for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns A result containing the user's boost balance or an error
   */
  async getUserBoostBalance(userId: string, competitionId: string) {
    return ResultAsync.fromPromise(
      // Get the user to validate they exist
      this.userRepository.findById(userId),
      () => BoostError.RepositoryError as const,
    )
      .andThen((user) => {
        if (!user) {
          return errAsync(BoostError.UserNotFound as const);
        }
        return ResultAsync.fromPromise(
          this.boostRepository.userBoostBalance({
            userId: user.id,
            competitionId,
          }),
          () => BoostError.RepositoryError as const,
        );
      })
      .map((balance) => attoValueToNumberValue(balance));
  }

  /**
   * Get agent boost totals for a competition
   * @param competitionId The competition ID
   * @returns A result containing a map of agent IDs to their boost totals or an error
   */
  async getAgentBoostTotals(competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.agentBoostTotals({
        competitionId,
      }),
      () => BoostError.RepositoryError as const,
    ).map((totals) =>
      Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [
          key,
          attoValueToNumberValue(value),
        ]),
      ),
    );
  }

  /**
   * Get user boosts for a competition
   * @param userId The user ID
   * @param competitionId The competition ID
   * @returns A result containing a map of agent IDs to boost amounts or an error
   */
  async getUserBoosts(userId: string, competitionId: string) {
    return ResultAsync.fromPromise(
      this.boostRepository.userBoosts({
        userId,
        competitionId,
      }),
      () => BoostError.RepositoryError as const,
    ).map((boosts) =>
      Object.fromEntries(
        Object.entries(boosts).map(([key, value]) => [
          key,
          attoValueToNumberValue(value),
        ]),
      ),
    );
  }

  /**
   * Boost an agent in a competition
   * @param params The boost parameters
   * @returns The result of the boost operation
   */
  async boostAgent(params: BoostAgentParams) {
    const { userId, competitionId, agentId, amount, idemKey } = params;
    return ResultAsync.fromPromise(
      this.userRepository.findById(userId),
      () => BoostError.RepositoryError as const,
    )
      .andThen((user) => {
        if (!user) {
          return errAsync(BoostError.UserNotFound as const);
        }
        return ResultAsync.fromPromise(
          this.competitionRepository.findById(competitionId),
          () => BoostError.RepositoryError as const,
        ).map((competition) => ({ user, competition }));
      })
      .andThen(({ user, competition }) => {
        if (!competition) {
          return errAsync(BoostError.CompetitionNotFound as const);
        }
        // Validate voting dates are set
        if (
          competition.votingStartDate == null ||
          competition.votingEndDate == null
        ) {
          return errAsync(BoostError.CompetitionMissingVotingDates as const);
        }
        // Validate we're within the voting time window
        const now = new Date();
        if (
          !(
            competition.votingStartDate < now && now < competition.votingEndDate
          )
        ) {
          return errAsync(BoostError.OutsideCompetitionBoostWindow as const);
        }
        return ResultAsync.fromPromise(
          this.boostRepository.boostAgent({
            userId,
            wallet: user.walletAddress,
            agentId,
            competitionId,
            amount: valueToAttoBigInt(amount),
            idemKey,
          }),
          () => BoostError.RepositoryError as const,
        ).andThen((result) => {
          if (result.type === "noop") {
            return errAsync(BoostError.AlreadyBoostedAgent as const);
          }
          return ok({
            ...result,
            agentBoostTotal: {
              ...result.agentBoostTotal,
              total: attoValueToNumberValue(result.agentBoostTotal.total),
            },
          });
        });
      });
  }
}
