import type { Transaction } from "@recallnet/db-schema/types";

import type {
  BoostDiffResult,
  BoostRepository,
} from "@/database/repositories/boost.repository.js";
import type { UserService } from "@/services/user.service.js";

export { BoostAwardService };

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

const TEXT_ENCODER = new TextEncoder();

const DECIMALS = 18; // RECALL TOKEN DECIMALS

class BoostAwardService {
  readonly #boostRepository: BoostRepository;
  readonly #userService: UserService;
  readonly #divisor: bigint;

  constructor(boostRepository: BoostRepository, userService: UserService) {
    this.#boostRepository = boostRepository;
    this.#userService = userService;
    this.#divisor = 10n ** BigInt(DECIMALS);
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
    const boostAmount = (stake.amount * multiplier) / this.#divisor;
    return this.#boostRepository.increase(
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
}
