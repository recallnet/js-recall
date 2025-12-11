import { ArenaRepository } from "@recallnet/db/repositories/arena";
import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionRewardsRepository } from "@recallnet/db/repositories/competition-rewards";
import { Database } from "@recallnet/db/types";

import {
  CreateCompetitionParams,
  ICompetitionService,
} from "./competition.interface.js";
import { BaseCompetitionService } from "./competition.service.js";

export class CompetitionCoordinator {
  private readonly baseCompetitionService: BaseCompetitionService;
  constructor(
    private readonly db: Database,
    private readonly arenaRepo: ArenaRepository,
    private readonly competitionRepo: CompetitionRepository,
    private readonly competitionRewardsRepo: CompetitionRewardsRepository,
    private readonly competitionService: ICompetitionService,
  ) {
    this.db = db;
    this.baseCompetitionService = new BaseCompetitionService(
      arenaRepo,
      competitionRepo,
      competitionRewardsRepo,
      db,
    );
    this.competitionService = competitionService;
  }

  async createCompetition(input: CreateCompetitionParams) {
    return await this.db.transaction(async (tx) => {
      const result = await this.baseCompetitionService.createCompetition(
        input,
        tx,
      );

      await this.competitionService.createCompetition(input, tx);

      return result;
    });
  }
}
