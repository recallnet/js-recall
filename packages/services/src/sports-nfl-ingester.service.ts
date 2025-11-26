import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamePredictionsRepository } from "@recallnet/db/repositories/game-predictions";
import { GamesRepository } from "@recallnet/db/repositories/games";
import type {
  NflGameStatus,
  NflTeam,
  SelectGame,
  SelectGamePrediction,
} from "@recallnet/db/schema/sports/types";
import type { Database, Transaction } from "@recallnet/db/types";

import { GameScoringService } from "./game-scoring.service.js";
import { SportsDataIONflProvider } from "./providers/sportsdataio.provider.js";
import type {
  SportsDataIOGameStatus,
  SportsDataIOPlayByPlay,
} from "./types/sports.js";

/**
 * NFL Game and Play Ingester Service
 * Fetches live data from SportsDataIO and ingests into database
 */
export class NflIngesterService {
  readonly #db: Database;
  readonly #gamesRepo: GamesRepository;
  readonly #gamePlaysRepo: GamePlaysRepository;
  readonly #gamePredictionsRepo: GamePredictionsRepository;
  readonly #competitionRepo: CompetitionRepository;
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #gameScoringService: GameScoringService;
  readonly #provider: SportsDataIONflProvider;
  readonly #logger: Logger;

  constructor(
    db: Database,
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    gamePredictionsRepo: GamePredictionsRepository,
    competitionRepo: CompetitionRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    gameScoringService: GameScoringService,
    provider: SportsDataIONflProvider,
    logger: Logger,
  ) {
    this.#db = db;
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#gamePredictionsRepo = gamePredictionsRepo;
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

    const activeNflCompetitions = competitions.filter(
      (c) => c.type === "sports_prediction",
    );

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
   * Discover final games that are missing winner or endTime
   * These games were marked final by schedule sync but need play-by-play data
   * @returns Array of final games missing scoring data
   */
  async discoverUnscoredFinalGames(): Promise<SelectGame[]> {
    // Find all active NFL competitions
    const { competitions } = await this.#competitionRepo.findByStatus({
      status: "active",
      params: {
        sort: "createdAt",
        limit: 100,
        offset: 0,
      },
    });
    const activeNflCompetitions = competitions.filter(
      (c) => c.type === "sports_prediction",
    );
    if (activeNflCompetitions.length === 0) {
      this.#logger.debug("No active NFL competitions found");
      return [];
    }
    const allGameIds: string[] = [];
    for (const competition of activeNflCompetitions) {
      const gameIds =
        await this.#competitionGamesRepo.findGameIdsByCompetitionId(
          competition.id,
        );
      allGameIds.push(...gameIds);
    }

    // Get games without finalization data
    const uniqueGameIds = [...new Set(allGameIds)];
    if (uniqueGameIds.length === 0) {
      this.#logger.debug("No games found in active competitions");
      return [];
    }
    const games = await this.#gamesRepo.findByIds(uniqueGameIds);
    const unscoredFinalGames = games.filter(
      (g) => g.status === "final" && (g.winner === null || g.endTime === null),
    );

    this.#logger.info(
      { count: unscoredFinalGames.length, total: games.length },
      "Found final games missing scoring data",
    );

    return unscoredFinalGames;
  }

  /**
   * Ingest play-by-play data for all active games in active competitions
   * Also processes any final games that are missing scoring data
   * @returns Number of games ingested
   */
  async ingestGamePlays(): Promise<{ count: number; gameIds: string[] }> {
    // Get both in-progress games and final games missing scoring data
    const activeGames = await this.discoverActiveGames();
    const unscoredFinalGames = await this.discoverUnscoredFinalGames();
    const allGamesToProcess = new Map<string, SelectGame>();
    for (const game of activeGames) {
      allGamesToProcess.set(game.id, game);
    }
    for (const game of unscoredFinalGames) {
      allGamesToProcess.set(game.id, game);
    }

    const gamesToIngest = Array.from(allGamesToProcess.values());
    if (gamesToIngest.length === 0) {
      this.#logger.debug(
        "No games to ingest (no in-progress or unscored final games)",
      );
      return { count: 0, gameIds: [] };
    }

    this.#logger.info(
      {
        count: gamesToIngest.length,
        active: activeGames.length,
        unscored: unscoredFinalGames.length,
      },
      "Ingesting games",
    );

    let ingestedCount = 0;
    for (const game of gamesToIngest) {
      try {
        this.#logger.info(
          `Ingesting game ${game.id} (${game.awayTeam} @ ${game.homeTeam}, status: ${game.status})...`,
        );
        await this.ingestGamePlayByPlay(game.providerGameId);
        ingestedCount++;
      } catch (error) {
        this.#logger.error(
          { error, gameId: game.id, providerGameId: game.providerGameId },
          "Error ingesting game, continuing with others",
        );
        // Continue with other games
      }
    }

    this.#logger.info(
      `Successfully ingested ${ingestedCount}/${gamesToIngest.length} games`,
    );

    return {
      count: ingestedCount,
      gameIds: gamesToIngest.map((g) => g.id),
    };
  }

  /**
   * Sync NFL schedule for a season
   * Fetches schedule from SportsDataIO and upserts games into database
   * @param season Season year (e.g., "2025" or "2025reg")
   * @returns Object with synced and error counts
   */
  async syncSchedule(season: string): Promise<{
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
          providerGameId: game.GlobalGameID,
          season: game.Season,
          week: game.Week,
          startTime: new Date(game.Date),
          homeTeam: game.HomeTeam,
          awayTeam: game.AwayTeam,
          spread: game.PointSpread,
          overUnder: game.OverUnder,
          awayTeamMoneyLine: game.AwayTeamMoneyLine,
          homeTeamMoneyLine: game.HomeTeamMoneyLine,
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
            providerGameId: game.GlobalGameID,
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
   * @param providerGameId SportsDataIO provider game ID (e.g., 19068)
   * @returns Database game ID
   */
  async ingestGamePlayByPlay(providerGameId: number): Promise<string> {
    try {
      // Fetch play-by-play data
      const data = await this.#provider.getPlayByPlay(providerGameId);

      // Execute ingester for game + plays atomically
      const { game, finalizeContext } = await this.#db.transaction(
        async (tx: Transaction) => {
          const gameResult = await this.#ingestGame(data, tx);
          await this.#ingestPlays(data, gameResult.game.id, tx);
          return gameResult;
        },
      );

      if (finalizeContext) {
        await this.finalizeGame(
          game.id,
          finalizeContext.endTime,
          finalizeContext.winner,
        );
      }

      return game.id;
    } catch (error) {
      this.#logger.error(
        { error, providerGameId },
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
   * Snapshot pregame predictions when a game starts
   * Takes the most recent prediction for each agent made before game start
   * and creates a new prediction record at the game start time
   * @param gameId Game ID
   * @param gameStartTime Game start time
   * @returns Number of predictions snapshotted
   */
  async #snapshotPregamePredictions(
    gameId: string,
    gameStartTime: Date,
    tx: Transaction,
  ): Promise<number> {
    try {
      // Find all predictions made before the game started
      const preGamePredictions =
        await this.#gamePredictionsRepo.findPregamePredictions(
          gameId,
          gameStartTime,
          tx,
        );

      if (preGamePredictions.length === 0) {
        this.#logger.debug({ gameId }, "No pregame predictions to snapshot");
        return 0;
      }

      // Group by agent and competition to capture distinct participation per competition
      const latestByAgentAndCompetition = new Map<
        string,
        SelectGamePrediction
      >();
      for (const pred of preGamePredictions) {
        const key = `${pred.agentId}:${pred.competitionId}`;
        const existing = latestByAgentAndCompetition.get(key);
        if (!existing || pred.createdAt > existing.createdAt) {
          latestByAgentAndCompetition.set(key, pred);
        }
      }

      // Create snapshot at game start time for each agent+competition pair
      let snapshotCount = 0;
      for (const latestPred of latestByAgentAndCompetition.values()) {
        await this.#gamePredictionsRepo.create(
          {
            competitionId: latestPred.competitionId,
            gameId: latestPred.gameId,
            agentId: latestPred.agentId,
            predictedWinner: latestPred.predictedWinner,
            confidence: latestPred.confidence,
            reason: latestPred.reason,
            createdAt: gameStartTime,
          },
          tx,
        );
        snapshotCount++;
      }

      this.#logger.info(
        {
          gameId,
          snapshotCount,
          totalPreGamePredictions: preGamePredictions.length,
        },
        "Snapshotted pregame predictions at game start",
      );

      return snapshotCount;
    } catch (error) {
      this.#logger.error(
        { error, gameId },
        "Error in snapshotPregamePredictions",
      );
      throw error;
    }
  }

  /**
   * Ingest game metadata and finalize if game is over
   */
  async #ingestGame(
    data: SportsDataIOPlayByPlay,
    tx: Transaction,
  ): Promise<{
    game: SelectGame;
    finalizeContext?: { winner: NflTeam; endTime: Date };
  }> {
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

    // Check if game was already final (note: row-locked)
    const existingGame = await this.#gamesRepo.findByProviderGameIdForUpdate(
      score.GlobalGameID,
      tx,
    );
    const wasAlreadyFinal =
      existingGame?.status === "final" &&
      existingGame.winner !== null &&
      existingGame.endTime !== null;
    // If game was already final, return the existing game
    if (wasAlreadyFinal) {
      return { game: existingGame };
    }

    // Determine end time with fallback chain:
    // 1. GameEndDateTime from API (most accurate)
    // 2. Last play time from play-by-play data
    // 3. Current time (fallback)
    let finalizeContext: { winner: NflTeam; endTime: Date } | undefined;
    if (status === "final") {
      if (score.AwayScore === null || score.HomeScore === null) {
        this.#logger.warn(
          { providerGameId: score.GlobalGameID },
          "Game is final but scores are missing, skipping finalization",
        );
      } else {
        const winner: NflTeam =
          score.AwayScore > score.HomeScore ? score.AwayTeam : score.HomeTeam;

        let endTime: Date;
        if (score.GameEndDateTime) {
          endTime = new Date(score.GameEndDateTime);
          this.#logger.debug(
            { gameEndDateTime: score.GameEndDateTime },
            "Using GameEndDateTime from API as game end time",
          );
        } else if (data.Plays && data.Plays.length > 0) {
          const lastPlay = data.Plays.reduce((latest, play) =>
            play.Sequence > latest.Sequence ? play : latest,
          );
          endTime = new Date(lastPlay.PlayTime);
          this.#logger.debug(
            {
              lastPlayTime: lastPlay.PlayTime,
              sequence: lastPlay.Sequence,
            },
            "GameEndDateTime not available, using last play time as game end time",
          );
        } else {
          endTime = new Date();
          this.#logger.warn(
            { providerGameId: score.GlobalGameID },
            "No GameEndDateTime or plays available, using current time as game end time",
          );
        }

        finalizeContext = { winner, endTime };
      }
    }

    // Upsert game with any final state data
    const game = await this.#gamesRepo.upsert(
      {
        providerGameId: score.GlobalGameID,
        season: score.Season,
        week: score.Week,
        startTime: new Date(score.Date),
        homeTeam: score.HomeTeam,
        awayTeam: score.AwayTeam,
        awayTeamMoneyLine: score.AwayTeamMoneyLine,
        homeTeamMoneyLine: score.HomeTeamMoneyLine,
        venue: score.StadiumDetails?.Name || null,
        status,
        winner: finalizeContext?.winner,
        endTime: finalizeContext?.endTime,
      },
      tx,
    );

    // If game just started (transitioned from scheduled to in_progress), snapshot pregame predictions
    if (status === "in_progress" && existingGame?.status === "scheduled") {
      this.#logger.info(
        { gameId: game.id, providerGameId: score.GlobalGameID },
        "Game just started, snapshotting pregame predictions",
      );
      await this.#snapshotPregamePredictions(game.id, game.startTime, tx);
    }

    // If game just became final (wasn't final before), finalize and score it
    if (status === "final") {
      if (!finalizeContext) {
        this.#logger.warn(
          { gameId: game.id, providerGameId: score.GlobalGameID },
          "Game is final but missing scoring context, skipping finalization",
        );
        return { game };
      }

      this.#logger.info(
        {
          gameId: game.id,
          providerGameId: score.GlobalGameID,
          winner: finalizeContext.winner,
          awayScore: score.AwayScore,
          homeScore: score.HomeScore,
          endTime: finalizeContext.endTime,
        },
        "Game ended, finalizing and scoring",
      );

      return {
        game,
        finalizeContext,
      };
    }

    return { game };
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
    tx: Transaction,
  ): Promise<void> {
    let ingestedCount = 0;
    const scoreboard = data.Score;

    // First, ingest all completed plays from the Plays array
    for (const play of data.Plays) {
      try {
        await this.#gamePlaysRepo.upsert(
          {
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
            awayScore: scoreboard?.AwayScore ?? null,
            homeScore: scoreboard?.HomeScore ?? null,
            playType: play.Type,
            team: play.Team,
            opponent: play.Opponent,
            description: play.Description,
          },
          tx,
        );

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
