import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
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
  readonly #competitionRepo: CompetitionRepository;
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #logger: Logger;

  constructor(
    competitionRepo: CompetitionRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    logger: Logger,
  ) {
    this.#competitionRepo = competitionRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#logger = logger;
  }

  /**
   * Get open plays for a competition
   * @param competitionId Competition ID
   * @param limit Maximum number of plays to return
   * @param offset Offset for pagination
   * @returns Array of open plays with game context and total count
   */
  async getOpenPlays(
    competitionId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ plays: PlayWithContext[]; total: number }> {
    try {
      // Validate competition exists
      const competition = await this.#competitionRepo.findById(competitionId);
      if (!competition) {
        throw new Error(`Competition ${competitionId} not found`);
      }

      // Get game IDs for this competition
      const gameIds =
        await this.#competitionGamesRepo.findGameIdsByCompetitionId(
          competitionId,
        );

      if (gameIds.length === 0) {
        return { plays: [], total: 0 };
      }

      // Fetch open plays and total count
      const [plays, total] = await Promise.all([
        this.#gamePlaysRepo.findOpenByGameIds(gameIds, limit, offset),
        this.#gamePlaysRepo.countOpenByGameIds(gameIds),
      ]);

      // Fetch game details for context
      const games = await this.#gamesRepo.findByIds(plays.map((p) => p.gameId));
      const gamesMap = new Map(games.map((g) => [g.id, g]));

      // Combine plays with game context
      const playsWithContext: PlayWithContext[] = plays.map((play) => {
        const game = gamesMap.get(play.gameId);
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
      });

      return { plays: playsWithContext, total };
    } catch (error) {
      this.#logger.error("Error in getOpenPlays:", error);
      throw error;
    }
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
      this.#logger.error("Error in getPlayById:", error);
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
      this.#logger.error("Error in isPlayOpen:", error);
      throw error;
    }
  }
}
