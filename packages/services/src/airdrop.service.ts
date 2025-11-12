import { Logger } from "pino";

import { AirdropRepository } from "@recallnet/db/repositories/airdrop";

export class AirdropService {
  private readonly airdropRepository: AirdropRepository;
  private readonly logger: Logger;

  constructor(airdropRepository: AirdropRepository, logger: Logger) {
    this.airdropRepository = airdropRepository;
    this.logger = logger;
  }

  // TODO: Make the acutal service function we need, not just the example below.

  async checkEligibility(address: string, season: number) {
    // TODO: Whatever checks we want to do.
    // No idea if/how season fits in here.
    console.log(`season is ${season}, address is ${address}`); // log to fix lint
    const res = await this.airdropRepository.getClaimByAddress(address);
    return res;
  }
}
