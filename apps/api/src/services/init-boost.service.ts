import { type BoostRepository } from "@recallnet/db/repositories/boost";
import { type CompetitionRepository } from "@recallnet/db/repositories/competition";
import { InsertUser } from "@recallnet/db/schema/core/types";
import { Database } from "@recallnet/db/types";

type InitBoostResult = {
  type: "boostGranted" | "alreadyGranted";
  competitionId: string;
  balance: bigint;
};

export interface InitBoostService {
  initBoost(user: InsertUser): Promise<InitBoostResult[]>;
}

export class PreTGEInitBoostService implements InitBoostService {
  readonly #db: Database;
  readonly #competitionRepo: CompetitionRepository;
  readonly #boostRepo: BoostRepository;
  readonly #boostAmount: bigint;

  constructor(
    db: Database,
    competitionRepo: CompetitionRepository,
    boostRepo: BoostRepository,
    boostAmount: bigint,
  ) {
    this.#db = db;
    this.#competitionRepo = competitionRepo;
    this.#boostRepo = boostRepo;
    this.#boostAmount = boostAmount;
  }

  async initBoost(user: InsertUser): Promise<InitBoostResult[]> {
    return this.#db.transaction(async (tx) => {
      const competitions = await this.#competitionRepo.findVotingOpen(tx);

      if (competitions.length === 0) {
        return [];
      }

      return Promise.all(
        competitions.map(async (competition) => {
          const existingBalance = await this.#boostRepo.userBoostBalance(
            {
              userId: user.id,
              competitionId: competition.id,
            },
            tx,
          );
          if (existingBalance > 0n) {
            return {
              type: "alreadyGranted",
              competitionId: competition.id,
              balance: existingBalance,
            } as InitBoostResult;
          }
          const increaseBoostRes = await this.#boostRepo.increase(
            {
              userId: user.id,
              competitionId: competition.id,
              amount: this.#boostAmount,
              wallet: user.walletAddress,
            },
            tx,
          );
          return {
            type: "boostGranted",
            competitionId: competition.id,
            balance:
              increaseBoostRes.type === "applied"
                ? increaseBoostRes.balanceAfter
                : increaseBoostRes.balance,
          } as InitBoostResult;
        }),
      );
    });
  }
}
