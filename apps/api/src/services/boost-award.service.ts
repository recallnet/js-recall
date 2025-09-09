import type { DbTransaction } from "@/database/db.js";
import type {
  BoostDiffResult,
  BoostRepository,
} from "@/database/repositories/boost.repository.js";
import type { CompetitionManager } from "@/services/competition-manager.service.js";

export { BoostAwardService };

type StakePosition = {
  id: bigint;
  wallet: Uint8Array;
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

const DECIMALS = 18; // FIXME Config??

class BoostAwardService {
  readonly #boostRepository: BoostRepository;
  readonly #competitionManager: CompetitionManager;
  readonly #divisor: bigint;

  constructor(
    boostRepository: BoostRepository,
    competitionManager: CompetitionManager,
  ) {
    this.#boostRepository = boostRepository;
    this.#competitionManager = competitionManager;
    this.#divisor = 10n ** BigInt(DECIMALS);
  }

  // FIXME Play with scenarios

  async awardForStake(
    stake: StakePosition,
    competition: CompetitionPosition,
    tx?: DbTransaction,
  ): Promise<BoostDiffResult> {
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
    const idemKeyString = new URLSearchParams({
      competition: competition.id,
      stake: stake.id.toString(),
    }).toString();
    const idemKey = TEXT_ENCODER.encode(idemKeyString);
    return this.#boostRepository.increase(
      {
        wallet: stake.wallet,
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
}
