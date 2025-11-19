import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";
import {
  NflGameStatus,
  NflTeam,
  SelectGame,
} from "@recallnet/db/schema/sports/types";

import { GameScoringService } from "./game-scoring.service.js";
import {
  SportsDataIOGameStatus,
  SportsDataIONflProvider,
  SportsDataIOPlayByPlay,
} from "./providers/sportsdataio-nfl.provider.js";

/**
 * NFL Live Ingestor Service
 * Fetches live data from SportsDataIO and ingests into database
 */
export class NflLiveIngestorService {
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #competitionRepo: CompetitionRepository;
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #gameScoringService: GameScoringService;
  readonly #provider: SportsDataIONflProvider;
  readonly #logger: Logger;

  constructor(
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    competitionRepo: CompetitionRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    gameScoringService: GameScoringService,
    provider: SportsDataIONflProvider,
    logger: Logger,
  ) {
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#competitionRepo = competitionRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#provider = provider;
    this.#gameScoringService = gameScoringService;
    this.#logger = logger;
  }

  /**
   * Discover active NFL competitions and their in-progress games
   * @returns Array of in-progress games from active competitions
   */
  async discoverActiveGames(): Promise<SelectGame[]> {
    // Find all active NFL competitions
    const { competitions } = await this.#competitionRepo.findByStatus({
      status: "active",
      params: {
        sort: "createdAt",
        limit: 100,
        offset: 0,
      },
    });

    const activeNflCompetitions = competitions.filter((c) => c.type === "nfl");

    if (activeNflCompetitions.length === 0) {
      this.#logger.debug("No active NFL competitions found");
      return [];
    }

    this.#logger.info(
      `Found ${activeNflCompetitions.length} active NFL competitions: ${activeNflCompetitions.map((c) => c.id).join(", ")}`,
    );

    // Collect all game IDs from all active competitions
    const allGameIds: string[] = [];
    for (const competition of activeNflCompetitions) {
      const gameIds =
        await this.#competitionGamesRepo.findGameIdsByCompetitionId(
          competition.id,
        );
      allGameIds.push(...gameIds);
    }

    // Remove duplicates (a game might be in multiple competitions)
    const uniqueGameIds = [...new Set(allGameIds)];

    if (uniqueGameIds.length === 0) {
      this.#logger.debug("No games found in active competitions");
      return [];
    }

    // Get game details
    const games = await this.#gamesRepo.findByIds(uniqueGameIds);

    // Filter for in-progress games only
    const inProgressGames = games.filter((g) => g.status === "in_progress");

    this.#logger.info(
      `Found ${inProgressGames.length} in-progress games out of ${games.length} total games`,
    );

    return inProgressGames;
  }

  /**
   * Ingest play-by-play data for all active games in active competitions
   * @returns Number of games ingested
   */
  async ingestActiveGames(): Promise<number> {
    const activeGames = await this.discoverActiveGames();

    if (activeGames.length === 0) {
      this.#logger.warn("No active competitions with in-progress games found");
      return 0;
    }

    this.#logger.info(
      `Ingesting ${activeGames.length} in-progress games across active competitions`,
    );

    let ingestedCount = 0;
    for (const game of activeGames) {
      try {
        this.#logger.info(
          `Ingesting game ${game.id} (${game.awayTeam} @ ${game.homeTeam})...`,
        );
        await this.ingestGamePlayByPlay(game.globalGameId);
        ingestedCount++;
      } catch (error) {
        this.#logger.error(
          { error, gameId: game.id, globalGameId: game.globalGameId },
          "Error ingesting game, continuing with others",
        );
        // Continue with other games
      }
    }

    this.#logger.info(
      `Successfully ingested ${ingestedCount}/${activeGames.length} games`,
    );

    return ingestedCount;
  }

  /**
   * Sync NFL schedule for a season
   * Fetches schedule from SportsDataIO and upserts games into database
   * @param season Season year (e.g., 2025)
   * @returns Object with synced and error counts
   */
  async syncSchedule(season: number): Promise<{
    syncedCount: number;
    errorCount: number;
    totalGames: number;
  }> {
    this.#logger.info(`Fetching NFL schedule for ${season} season...`);

    const schedule = await this.#provider.getSchedule(season);

    this.#logger.info(`Fetched ${schedule.length} entries from SportsDataIO`);

    // Filter out BYE weeks
    const actualGames = schedule.filter(
      (game) => game.AwayTeam !== "BYE" && game.HomeTeam !== "BYE",
    );

    this.#logger.info(
      `Filtered to ${actualGames.length} actual games (${schedule.length - actualGames.length} BYE weeks skipped)`,
    );

    let syncedCount = 0;
    let errorCount = 0;
    for (const game of actualGames) {
      try {
        await this.#gamesRepo.upsert({
          globalGameId: game.GlobalGameID,
          gameKey: game.GameKey,
          startTime: new Date(game.Date),
          homeTeam: game.HomeTeam,
          awayTeam: game.AwayTeam,
          venue: game.StadiumDetails?.Name || null,
          status: this.#mapResponseToNflGameStatus(game.Status),
        });

        syncedCount++;

        if (syncedCount % 10 === 0) {
          this.#logger.info(
            `Synced ${syncedCount}/${actualGames.length} games...`,
          );
        }
      } catch (error) {
        this.#logger.error(
          {
            error,
            globalGameId: game.GlobalGameID,
            gameKey: game.GameKey,
          },
          "Error syncing game",
        );
        errorCount++;
      }
    }

    this.#logger.info(
      `Schedule sync complete: ${syncedCount} synced, ${errorCount} errors (${schedule.length - actualGames.length} BYE weeks skipped)`,
    );

    return {
      syncedCount,
      errorCount,
      totalGames: actualGames.length,
    };
  }

  /**
   * Map SportsDataIO game status to database game status
   * @param status SportsDataIO status.
   * @returns Database game status
   */
  #mapResponseToNflGameStatus(status: SportsDataIOGameStatus): NflGameStatus {
    switch (status) {
      case "Scheduled":
      case "Delayed":
      case "Postponed":
        return "scheduled";
      case "InProgress":
        return "in_progress";
      case "Final":
      case "F/OT":
      case "Suspended":
      case "Canceled":
      case "Forfeit":
        return "final";
      default:
        throw new Error(`Unknown game status "${status}"`);
    }
  }

  /**
   * Ingest play-by-play data for a game
   * @param globalGameId SportsDataIO global game ID (e.g., 19068)
   * @returns Database game ID
   */
  async ingestGamePlayByPlay(globalGameId: number): Promise<string> {
    try {
      // Fetch play-by-play data
      const data = await this.#provider.getPlayByPlay(globalGameId);

      // Ingest or update game
      const dbGame = await this.#ingestGame(data);

      // Ingest plays
      await this.#ingestPlays(data, dbGame.id);

      return dbGame.id;
    } catch (error) {
      this.#logger.error(
        { error, globalGameId },
        "Error ingesting play-by-play for game",
      );
      throw error;
    }
  }

  /**
   * Finalize a game and trigger scoring
   * @param gameId Database game ID
   * @param endTime Game end time
   * @param winner Winning team ticker
   * @returns Number of agents scored
   */
  async finalizeGame(
    gameId: string,
    endTime: Date,
    winner: NflTeam,
  ): Promise<number> {
    try {
      // Update game with end time and winner
      await this.#gamesRepo.finalizeGame(gameId, endTime, winner);

      this.#logger.info(
        { gameId, winner, endTime },
        "Game finalized, triggering scoring",
      );

      // Score all predictions for this game
      const scoredCount = await this.#gameScoringService.scoreGame(gameId);

      this.#logger.info({ gameId, scoredCount }, "Game scoring complete");

      return scoredCount;
    } catch (error) {
      this.#logger.error({ error, gameId }, "Error in finalizeGame");
      throw error;
    }
  }

  /**
   * Ingest game metadata and finalize if game is over
   */
  async #ingestGame(data: SportsDataIOPlayByPlay): Promise<SelectGame> {
    const score = data.Score;

    // Map SportsDataIO status to our status
    let status: NflGameStatus;
    if (score.IsOver) {
      status = "final";
    } else if (score.IsInProgress) {
      status = "in_progress";
    } else {
      status = "scheduled";
    }

    // Check if game was already final
    const existingGame = await this.#gamesRepo.findByGlobalGameId(
      score.GlobalGameID,
    );
    const wasAlreadyFinal = existingGame?.status === "final";
    // If game was already final, return the existing game
    if (wasAlreadyFinal) {
      return existingGame;
    }

    // Upsert game
    const game = await this.#gamesRepo.upsert({
      globalGameId: score.GlobalGameID,
      gameKey: score.GameKey,
      startTime: new Date(score.Date),
      homeTeam: score.HomeTeam,
      awayTeam: score.AwayTeam,
      venue: score.StadiumDetails?.Name || null,
      status,
    });

    // If game just became final (wasn't final before), finalize and score it
    if (status === "final") {
      this.#logger.info(
        { status, wasAlreadyFinal },
        "Game is final, checking scores",
      );
      if (score.AwayScore === null || score.HomeScore === null) {
        this.#logger.warn(
          { gameId: game.id, globalGameId: score.GlobalGameID },
          "Game is final but scores are missing, skipping finalization",
        );
        return game;
      }

      // Determine winner
      const winner: NflTeam =
        score.AwayScore > score.HomeScore ? score.AwayTeam : score.HomeTeam;

      // Determine end time with fallback chain:
      // 1. GameEndDateTime from API (most accurate)
      // 2. Last play time from play-by-play data
      // 3. Current time (fallback)
      let endTime: Date;
      if (score.GameEndDateTime) {
        endTime = new Date(score.GameEndDateTime);
        this.#logger.debug(
          { gameEndDateTime: score.GameEndDateTime },
          "Using GameEndDateTime from API as game end time",
        );
      } else if (data.Plays && data.Plays.length > 0) {
        // Find the most recent play (highest sequence number)
        const lastPlay = data.Plays.reduce((latest, play) =>
          play.Sequence > latest.Sequence ? play : latest,
        );
        endTime = new Date(lastPlay.PlayTime);
        this.#logger.debug(
          { lastPlayTime: lastPlay.PlayTime, sequence: lastPlay.Sequence },
          "GameEndDateTime not available, using last play time as game end time",
        );
      } else {
        // Fallback to current time if no plays available
        endTime = new Date();
        this.#logger.warn(
          { gameId: game.id, globalGameId: score.GlobalGameID },
          "No GameEndDateTime or plays available, using current time as game end time",
        );
      }

      this.#logger.info(
        {
          gameId: game.id,
          globalGameId: score.GlobalGameID,
          winner,
          awayScore: score.AwayScore,
          homeScore: score.HomeScore,
          endTime,
        },
        "Game ended, finalizing and scoring",
      );

      // Finalize game and trigger scoring
      await this.finalizeGame(game.id, endTime, winner);
    }

    return game;
  }

  /**
   * Ingest plays for a game
   * Ingests all plays (predictable and non-predictable) from Plays array,
   * and creates an open play from current game state in Score object.
   * Non-predictable plays have actualOutcome=null and are excluded from predictions.
   */
  async #ingestPlays(
    data: SportsDataIOPlayByPlay,
    gameId: string,
  ): Promise<void> {
    let ingestedCount = 0;

    // First, ingest all completed plays from the Plays array
    for (const play of data.Plays) {
      try {
        await this.#gamePlaysRepo.upsert({
          gameId,
          providerPlayId: play.PlayID.toString(),
          sequence: play.Sequence,
          quarterName: play.QuarterName,
          timeRemainingMinutes: play.TimeRemainingMinutes,
          timeRemainingSeconds: play.TimeRemainingSeconds,
          playTime: new Date(play.PlayTime),
          down: play.Down,
          distance: play.Distance ? parseInt(play.Distance.toString()) : null,
          yardLine: play.YardLine,
          yardLineTerritory: play.YardLineTerritory,
          yardsToEndZone: play.YardsToEndZone,
          playType: play.Type,
          team: play.Team,
          opponent: play.Opponent,
          description: play.Description,
          outcome: play.Type,
        });

        ingestedCount++;
      } catch (error) {
        this.#logger.error(
          { error, gameId, sequence: play.Sequence },
          "Error ingesting play",
        );
        // Continue with other plays
      }
    }

    this.#logger.info(
      {
        gameId,
        ingestedCount,
      },
      "Ingested plays for game",
    );
  }
}
