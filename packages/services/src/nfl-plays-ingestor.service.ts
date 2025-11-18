import { Logger } from "pino";

import { CompetitionRepository } from "@recallnet/db/repositories/competition";
import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";
import { SelectGame } from "@recallnet/db/schema/sports/types";

import {
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
  readonly #provider: SportsDataIONflProvider;
  readonly #logger: Logger;

  constructor(
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    competitionRepo: CompetitionRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    provider: SportsDataIONflProvider,
    logger: Logger,
  ) {
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#competitionRepo = competitionRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#provider = provider;
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
   * @param lockOffsetMs Milliseconds before play to lock predictions
   * @returns Number of games ingested
   */
  async ingestActiveGames(lockOffsetMs: number = 3000): Promise<number> {
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
          `Ingesting game ${game.globalGameId} (${game.awayTeam} @ ${game.homeTeam})...`,
        );
        await this.ingestGamePlayByPlay(game.globalGameId, lockOffsetMs);
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
   * Score all resolved plays for active games
   * @param scoringService Service to use for scoring plays
   * @returns Number of plays scored
   */
  async scoreResolvedPlays(scoringService: {
    scorePlay: (playId: string) => Promise<number>;
  }): Promise<number> {
    const activeGames = await this.discoverActiveGames();

    if (activeGames.length === 0) {
      return 0;
    }

    this.#logger.debug(
      `Scoring resolved plays for ${activeGames.length} active games`,
    );

    let scoredCount = 0;
    for (const game of activeGames) {
      const plays = await this.#gamePlaysRepo.findByGameId(game.id);
      for (const play of plays) {
        if (play.status === "resolved" && play.actualOutcome) {
          try {
            await scoringService.scorePlay(play.id);
            scoredCount++;
          } catch (error) {
            // Play might already be scored, continue
            this.#logger.debug(
              { playId: play.id, error },
              "Skipping play (likely already scored)",
            );
          }
        }
      }
    }

    this.#logger.debug(`Scored ${scoredCount} plays`);
    return scoredCount;
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

    this.#logger.info(`Fetched ${schedule.length} games from SportsDataIO`);

    let syncedCount = 0;
    let errorCount = 0;

    for (const game of schedule) {
      try {
        await this.#gamesRepo.upsert({
          globalGameId: game.GlobalGameID,
          gameKey: game.GameKey,
          startTime: new Date(game.Date),
          homeTeam: game.HomeTeam,
          awayTeam: game.AwayTeam,
          venue: game.StadiumDetails?.Name || null,
          status:
            game.Status === "Final"
              ? "final"
              : game.Status === "InProgress"
                ? "in_progress"
                : "scheduled",
        });

        syncedCount++;

        if (syncedCount % 10 === 0) {
          this.#logger.info(
            `Synced ${syncedCount}/${schedule.length} games...`,
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
      `Schedule sync complete: ${syncedCount} synced, ${errorCount} errors`,
    );

    return {
      syncedCount,
      errorCount,
      totalGames: schedule.length,
    };
  }

  /**
   * Ingest play-by-play data for a game
   * @param globalGameId SportsDataIO global game ID (e.g., 19068)
   * @param lockOffsetMs Milliseconds before play to lock predictions
   * @returns Database game ID
   */
  async ingestGamePlayByPlay(
    globalGameId: number,
    lockOffsetMs: number = 3000,
  ): Promise<string> {
    try {
      // Fetch play-by-play data
      const data = await this.#provider.getPlayByPlay(globalGameId);

      // Ingest or update game
      const dbGame = await this.#ingestGame(data);

      // Ingest plays
      await this.#ingestPlays(data, dbGame.id, lockOffsetMs);

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
   * Ingest game metadata
   */
  async #ingestGame(data: SportsDataIOPlayByPlay) {
    const score = data.Score;

    // Map SportsDataIO status to our status
    let status: "scheduled" | "in_progress" | "final";
    if (score.IsOver) {
      status = "final";
    } else if (score.IsInProgress) {
      status = "in_progress";
    } else {
      status = "scheduled";
    }

    return await this.#gamesRepo.upsert({
      globalGameId: score.GlobalGameID,
      gameKey: score.GameKey,
      startTime: new Date(score.Date),
      homeTeam: score.HomeTeam,
      awayTeam: score.AwayTeam,
      venue: score.StadiumDetails?.Name || null,
      status,
    });
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
    lockOffsetMs: number,
  ): Promise<void> {
    const gameStartTime = new Date(data.Score.Date);
    let ingestedCount = 0;

    // First, ingest all completed plays from the Plays array
    for (const play of data.Plays) {
      try {
        // Calculate lock time
        const lockTime = SportsDataIONflProvider.calculateLockTime(
          play,
          gameStartTime,
          lockOffsetMs,
        );

        // Determine outcome (null for non-predictable plays)
        const actualOutcome = SportsDataIONflProvider.isPlayPredictable(play)
          ? SportsDataIONflProvider.determineOutcome(play)
          : null;

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
          lockTime,
          status: "resolved", // Completed plays are always resolved
          actualOutcome, // null for non-predictable plays
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

    // Second, create an "open" play for the current game state if game is in progress
    if (data.Score.IsInProgress && data.Score.Down && data.Score.Possession) {
      try {
        const lastPlaySequence =
          data.Plays.length > 0
            ? Math.max(...data.Plays.map((p) => p.Sequence))
            : 0;
        const nextSequence = lastPlaySequence + 1;

        // Calculate lock time for the pending play (now + lockOffset)
        const lockTime = new Date(Date.now() + lockOffsetMs);

        // Determine opponent
        const opponent =
          data.Score.Possession === data.Score.HomeTeam
            ? data.Score.AwayTeam
            : data.Score.HomeTeam;

        await this.#gamePlaysRepo.upsert({
          gameId,
          providerPlayId: null, // No PlayID yet - play hasn't happened
          sequence: nextSequence,
          quarterName: data.Score.Quarter || "1",
          timeRemainingMinutes: data.Score.TimeRemaining
            ? parseInt(data.Score.TimeRemaining.split(":")[0] || "0")
            : null,
          timeRemainingSeconds: data.Score.TimeRemaining
            ? parseInt(data.Score.TimeRemaining.split(":")[1] || "0")
            : null,
          playTime: null, // Play hasn't happened yet
          down: data.Score.Down,
          distance: data.Score.Distance
            ? parseInt(data.Score.Distance.toString())
            : null,
          yardLine: data.Score.YardLine,
          yardLineTerritory: data.Score.YardLineTerritory,
          yardsToEndZone: null, // Calculate if needed
          playType: null, // Unknown until play happens
          team: data.Score.Possession,
          opponent,
          description: data.Score.DownAndDistance
            ? `${data.Score.DownAndDistance} at ${data.Score.YardLineTerritory || ""} ${data.Score.YardLine || ""}`
            : "Pending play",
          lockTime,
          status: "open",
          actualOutcome: null, // Unknown until play happens
        });

        this.#logger.info(
          { gameId, sequence: nextSequence },
          "Created open play",
        );
        ingestedCount++;
      } catch (error) {
        this.#logger.error(
          { error, gameId },
          "Error creating open play for game",
        );
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
