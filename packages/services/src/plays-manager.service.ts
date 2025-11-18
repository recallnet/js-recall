import { Logger } from "pino";

import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { SelectGamePlay } from "@recallnet/db/schema/sports/types";

/**
 * Play with game context
 */
export interface PlayWithContext extends SelectGamePlay {
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    status: string;
  };
}

/**
 * Plays Manager Service
 * Handles business logic for fetching and managing plays
 */
export class PlaysManagerService {
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #logger: Logger;

  constructor(
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    logger: Logger,
  ) {
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#logger = logger;
  }

  /**
   * Get a specific play by ID
   * @param playId Play ID
   * @returns Play with game context or undefined
   */
  async getPlayById(playId: string): Promise<PlayWithContext | undefined> {
    try {
      const play = await this.#gamePlaysRepo.findById(playId);
      if (!play) {
        return undefined;
      }

      const game = await this.#gamesRepo.findById(play.gameId);
      if (!game) {
        throw new Error(`Game ${play.gameId} not found`);
      }

      return {
        ...play,
        game: {
          id: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          status: game.status,
        },
      };
    } catch (error) {
      this.#logger.error({ error }, "Error in getPlayById");
      throw error;
    }
  }

  /**
   * Check if a play is still open for predictions
   * @param playId Play ID
   * @returns True if play is open and before lock time
   */
  async isPlayOpen(playId: string): Promise<boolean> {
    try {
      const play = await this.#gamePlaysRepo.findById(playId);
      if (!play) {
        return false;
      }

      const now = new Date();
      return play.status === "open" && play.lockTime > now;
    } catch (error) {
      this.#logger.error({ error }, "Error in isPlayOpen");
      throw error;
    }
  }
}
