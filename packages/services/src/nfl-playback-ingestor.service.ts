import * as fs from "fs/promises";
import * as path from "path";
import { Logger } from "pino";

import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";

/**
 * Game data from baseline JSON
 */
export interface BaselineGame {
  globalGameId: number;
  gameKey: string;
  startTime: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string;
}

/**
 * Play data from baseline JSON (aligned with SportsDataIO structure)
 */
export interface BaselinePlay {
  providerPlayId?: string;
  sequence: number;
  quarterName: string;
  timeRemainingMinutes?: number;
  timeRemainingSeconds?: number;
  playTime?: string;
  down?: number | null;
  distance?: number | null;
  yardLine?: number;
  yardLineTerritory?: string;
  yardsToEndZone?: number;
  playType?: string;
  team: string;
  opponent: string;
  description?: string;
  lockMs: number;
  actualOutcome: "run" | "pass" | null;
}

/**
 * NFL Playback Ingestor Service
 * Reads baseline JSON files and replays them into the database
 */
export class NflPlaybackIngestorService {
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #logger: Logger;

  constructor(
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    logger: Logger,
  ) {
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#logger = logger;
  }

  /**
   * Load games from baseline JSON file
   * @param baselineDir Directory containing baseline data
   * @returns Array of baseline games
   */
  async loadGames(baselineDir: string): Promise<BaselineGame[]> {
    try {
      const gamesPath = path.join(baselineDir, "games.json");
      const content = await fs.readFile(gamesPath, "utf-8");
      const games = JSON.parse(content) as BaselineGame[];

      this.#logger.info(`Loaded ${games.length} games from ${gamesPath}`);
      return games;
    } catch (error) {
      this.#logger.error("Error loading games:", error);
      throw error;
    }
  }

  /**
   * Load plays for a specific game from baseline JSON
   * @param baselineDir Directory containing baseline data
   * @param globalGameId Global game ID
   * @returns Array of baseline plays
   */
  async loadPlays(
    baselineDir: string,
    globalGameId: number,
  ): Promise<BaselinePlay[]> {
    try {
      const playsPath = path.join(baselineDir, "plays", `${globalGameId}.json`);
      const content = await fs.readFile(playsPath, "utf-8");
      const plays = JSON.parse(content) as BaselinePlay[];

      this.#logger.info(
        `Loaded ${plays.length} plays for game ${globalGameId} from ${playsPath}`,
      );
      return plays;
    } catch (error) {
      this.#logger.error(
        `Error loading plays for game ${globalGameId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Ingest games into the database
   * @param games Array of baseline games
   * @returns Map of global game ID to database game ID
   */
  async ingestGames(games: BaselineGame[]): Promise<Map<number, string>> {
    const gameIdMap = new Map<number, string>();

    for (const game of games) {
      try {
        const dbGame = await this.#gamesRepo.upsert({
          globalGameId: game.globalGameId,
          gameKey: game.gameKey,
          startTime: new Date(game.startTime),
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          venue: game.venue || null,
          status: "scheduled",
        });

        gameIdMap.set(game.globalGameId, dbGame.id);
        this.#logger.info(
          `Ingested game ${game.globalGameId} (${game.gameKey}) -> ${dbGame.id}`,
        );
      } catch (error) {
        this.#logger.error(`Error ingesting game ${game.globalGameId}:`, error);
        throw error;
      }
    }

    return gameIdMap;
  }

  /**
   * Link games to a competition
   * @param competitionId Competition ID
   * @param gameIds Array of database game IDs
   */
  async linkGamesToCompetition(
    competitionId: string,
    gameIds: string[],
  ): Promise<void> {
    for (const gameId of gameIds) {
      try {
        await this.#competitionGamesRepo.create({
          competitionId,
          gameId,
        });
        this.#logger.info(
          `Linked game ${gameId} to competition ${competitionId}`,
        );
      } catch (error) {
        this.#logger.error(
          `Error linking game ${gameId} to competition ${competitionId}:`,
          error,
        );
        // Continue with other games even if one fails
      }
    }
  }

  /**
   * Ingest plays for a game
   * @param gameId Database game ID
   * @param plays Array of baseline plays
   * @param replaySpeed Speed multiplier for replay (1.0 = real-time)
   * @param startTime Base timestamp for calculating lock times
   */
  async ingestPlays(
    gameId: string,
    plays: BaselinePlay[],
    replaySpeed: number = 1.0,
    startTime: Date = new Date(),
  ): Promise<void> {
    for (const play of plays) {
      try {
        // Calculate lock time based on replay speed
        const lockTimeMs = startTime.getTime() + play.lockMs / replaySpeed;
        const lockTime = new Date(lockTimeMs);

        // Parse playTime if provided
        const playTime = play.playTime ? new Date(play.playTime) : null;

        await this.#gamePlaysRepo.upsert({
          gameId,
          providerPlayId: play.providerPlayId || null,
          sequence: play.sequence,
          quarterName: play.quarterName,
          timeRemainingMinutes: play.timeRemainingMinutes ?? null,
          timeRemainingSeconds: play.timeRemainingSeconds ?? null,
          playTime,
          down: play.down ?? null,
          distance: play.distance ?? null,
          yardLine: play.yardLine ?? null,
          yardLineTerritory: play.yardLineTerritory || null,
          yardsToEndZone: play.yardsToEndZone ?? null,
          playType: play.playType || null,
          team: play.team,
          opponent: play.opponent,
          description: play.description || null,
          lockTime,
          status: "open",
          actualOutcome: null, // Don't reveal outcome yet
        });

        this.#logger.debug(
          `Ingested play ${play.sequence} for game ${gameId}, locks at ${lockTime.toISOString()}`,
        );
      } catch (error) {
        this.#logger.error(
          `Error ingesting play ${play.sequence} for game ${gameId}:`,
          error,
        );
        throw error;
      }
    }

    this.#logger.info(`Ingested ${plays.length} plays for game ${gameId}`);
  }

  /**
   * Resolve a play with its actual outcome
   * @param gameId Database game ID
   * @param sequence Play sequence number
   * @param outcome Actual outcome
   */
  async resolvePlay(
    gameId: string,
    sequence: number,
    outcome: "run" | "pass",
  ): Promise<void> {
    try {
      const plays = await this.#gamePlaysRepo.findByGameId(gameId);
      const play = plays.find((p) => p.sequence === sequence);

      if (!play) {
        throw new Error(`Play ${sequence} not found for game ${gameId}`);
      }

      await this.#gamePlaysRepo.resolve(play.id, outcome);
      this.#logger.info(
        `Resolved play ${sequence} for game ${gameId}: ${outcome}`,
      );
    } catch (error) {
      this.#logger.error(
        `Error resolving play ${sequence} for game ${gameId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Update game status
   * @param globalGameId Global game ID
   * @param status New status
   */
  async updateGameStatus(
    globalGameId: number,
    status: "scheduled" | "in_progress" | "final",
  ): Promise<void> {
    try {
      const game = await this.#gamesRepo.findByGlobalGameId(globalGameId);
      if (!game) {
        throw new Error(`Game ${globalGameId} not found`);
      }

      await this.#gamesRepo.updateStatus(game.id, status);
      this.#logger.info(`Updated game ${globalGameId} status to ${status}`);
    } catch (error) {
      this.#logger.error(`Error updating game ${globalGameId} status:`, error);
      throw error;
    }
  }
}
