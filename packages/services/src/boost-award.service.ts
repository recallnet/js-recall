import type {
  BoostDiffResult,
  BoostRepository,
} from "@recallnet/db/repositories/boost";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { StakesRepository } from "@recallnet/db/repositories/stakes";
import { Database, Transaction } from "@recallnet/db/types";

import type { UserService } from "./user.service.js";

type StakePosition = {
  id: bigint;
  wallet: string;
  amount: bigint;
  stakedAt: Date;
  canUnstakeAfter: Date;
};

type CompetitionPosition = {
  id: string;
  votingStartDate: Date;
  votingEndDate: Date;
};

type InitForStakeResult = BoostDiffResult & {
  competitionId: string;
  stakeId: bigint;
};
type InitNoStakeResult = BoostDiffResult & { competitionId: string };

const TEXT_ENCODER = new TextEncoder();

export interface BoostAwardServiceConfig {
  boost: {
    noStakeBoostAmount?: bigint;
  };
}

export class BoostAwardService {
  readonly #db: Database;
  readonly #competitionRepo: CompetitionRepository;
  readonly #boostRepository: BoostRepository;
  readonly #stakesRepository: StakesRepository;
  readonly #userService: UserService;
  readonly #noStakeBoostAmount?: bigint;

  constructor(
    database: Database,
    competitionRepo: CompetitionRepository,
    boostRepository: BoostRepository,
    stakesRepository: StakesRepository,
    userService: UserService,
    config: BoostAwardServiceConfig,
  ) {
    this.#db = database;
    this.#competitionRepo = competitionRepo;
    this.#boostRepository = boostRepository;
    this.#stakesRepository = stakesRepository;
    this.#userService = userService;
    this.#noStakeBoostAmount = config.boost.noStakeBoostAmount;
  }

  awardAmountForStake(stake: StakePosition, competition: CompetitionPosition) {
    const stakedAt = stake.stakedAt.valueOf();
    const canUnstakeAfter = stake.canUnstakeAfter.valueOf();
    const votingEndDate = competition.votingEndDate.valueOf();
    const votingStartDate = competition.votingStartDate.valueOf();
    let multiplier: bigint;
    // Before voting starts
    if (stakedAt < votingStartDate) {
      // And covers the voting period
      if (canUnstakeAfter >= votingEndDate) {
        // Means can not unstake before the voting ends
        multiplier = 2n;
      } else {
        // Can unstake during the voting period
        multiplier = 1n;
      }
    } else {
      // Staked after the voting starts
      multiplier = 1n;
    }
    return stake.amount * multiplier;
  }

  async availableStakeAwards(wallet: string, competitionId: string) {
    const competition = await this.#competitionRepo.findById(competitionId);
    if (!competition) {
      throw new Error("Competition not found.");
    }

    const { id, votingStartDate, votingEndDate } = competition;

    if (!(votingStartDate && votingEndDate)) {
      throw new Error("Competition has no boost window.");
    }

    const stakes = await this.#boostRepository.unawardedStakes(
      wallet,
      competition.id,
    );

    return stakes.reduce(
      (acc, stake) => {
        const stakePosition: StakePosition = {
          ...stake,
          wallet,
        };
        const awardAmount = this.awardAmountForStake(stakePosition, {
          id,
          votingStartDate,
          votingEndDate,
        });

        acc.stakes.push({
          ...stake,
          awardAmount,
        });
        acc.totalAwardAmount += awardAmount;

        return acc;
      },
      {
        stakes: [] as Array<(typeof stakes)[0] & { awardAmount: bigint }>,
        totalAwardAmount: 0n,
      },
    );
  }

  async awardForStake(
    stake: StakePosition,
    competition: CompetitionPosition,
    tx?: Transaction,
  ): Promise<BoostDiffResult> {
    const wallet = stake.wallet;
    const idemKeyString = new URLSearchParams({
      competition: competition.id,
      stake: stake.id.toString(),
    }).toString();
    const idemKey = TEXT_ENCODER.encode(idemKeyString);
    const user = await this.#userService.getUserByWalletAddress(wallet);
    if (!user) {
      return {
        type: "noop",
        balance: 0n,
        idemKey: idemKey,
      };
    }
    const userId = user.id;
    const boostAmount = this.awardAmountForStake(stake, competition);
    const increaseRes = await this.#boostRepository.increase(
      {
        userId: userId,
        wallet: wallet,
        competitionId: competition.id,
        amount: boostAmount,
        meta: {
          description: `Award of ${boostAmount} based on stake ${stake.id}`,
        },
        idemKey: idemKey,
      },
      tx,
    );
    if (increaseRes.type === "applied") {
      await this.#boostRepository.recordStakeBoostAward(
        {
          competitionId: competition.id,
          stakeId: stake.id,
          boostChangeId: increaseRes.changeId,
        },
        tx,
      );
    }
    return increaseRes;
  }

  async awardNoStake(
    competitionId: string,
    userId: string,
    wallet: string,
    boostAmount: bigint,
    idemReason: string,
    tx?: Transaction,
  ): Promise<BoostDiffResult> {
    const idemKeyString = new URLSearchParams({
      competition: competitionId,
      reason: idemReason,
    }).toString();
    const idemKey = TEXT_ENCODER.encode(idemKeyString);
    return this.#boostRepository.increase(
      {
        userId: userId,
        wallet: wallet,
        competitionId: competitionId,
        amount: boostAmount,
        meta: {
          description: `Voluntary award of ${boostAmount}`,
        },
        idemKey: idemKey,
      },
      tx,
    );
  }

  async initForStake(
    wallet: string,
    tx?: Transaction,
  ): Promise<InitForStakeResult[]> {
    const executor = tx ?? this.#db;
    return executor.transaction(async (tx) => {
      const stakes = await this.#stakesRepository.allStakedByWallet(wallet, tx);
      if (stakes.length === 0) {
        return [];
      }

      const competitions = await this.#competitionRepo.findVotingOpen(tx);
      if (competitions.length === 0) {
        return [];
      }

      return Promise.all(
        competitions.flatMap((competition) => {
          const { votingStartDate, votingEndDate } = competition;
          if (!votingStartDate || !votingEndDate) {
            throw new Error("Competition missing voting dates");
          }
          return stakes.map(async (stake) => {
            const awardRes = await this.awardForStake(
              {
                ...stake,
                wallet,
              },
              {
                ...competition,
                votingStartDate,
                votingEndDate,
              },
              tx,
            );
            return {
              ...awardRes,
              competitionId: competition.id,
              stakeId: stake.id,
            };
          });
        }),
      );
    });
  }

  async initNoStake(
    userId: string,
    wallet: string,
    tx?: Transaction,
  ): Promise<InitNoStakeResult[]> {
    const executor = tx ?? this.#db;
    return executor.transaction(async (tx) => {
      const amount = this.#noStakeBoostAmount;
      if (!amount) {
        throw new Error("No-stake boost amount not configured");
      }
      const competitions = await this.#competitionRepo.findVotingOpen(tx);

      if (competitions.length === 0) {
        return [];
      }

      return Promise.all(
        competitions.map(async (competition) => {
          const awardRes = await this.awardNoStake(
            competition.id,
            userId,
            wallet,
            amount,
            "initNoStake",
            tx,
          );
          return {
            ...awardRes,
            competitionId: competition.id,
          };
        }),
      );
    });
  }
}
