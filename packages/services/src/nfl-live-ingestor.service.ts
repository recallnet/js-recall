import { Logger } from "pino";

import { CompetitionGamesRepository } from "@recallnet/db/repositories/competition-games";
import { GamePlaysRepository } from "@recallnet/db/repositories/game-plays";
import { GamesRepository } from "@recallnet/db/repositories/games";

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
  readonly #competitionGamesRepo: CompetitionGamesRepository;
  readonly #provider: SportsDataIONflProvider;
  readonly #logger: Logger;

  constructor(
    gamesRepo: GamesRepository,
    gamePlaysRepo: GamePlaysRepository,
    competitionGamesRepo: CompetitionGamesRepository,
    provider: SportsDataIONflProvider,
    logger: Logger,
  ) {
    this.#gamesRepo = gamesRepo;
    this.#gamePlaysRepo = gamePlaysRepo;
    this.#competitionGamesRepo = competitionGamesRepo;
    this.#provider = provider;
    this.#logger = logger;
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
        nonPredictableCount: data.Plays.length - ingestedCount,
      },
      "Ingested plays for game",
    );
  }

  /**
   * Ingest games for a specific week
   * @param season Year (e.g., 2025)
   * @param week Week number
   * @param competitionId Optional competition to link games to
   * @returns Array of database game IDs
   */
  async ingestWeek(
    season: number,
    week: number,
    competitionId?: string,
  ): Promise<string[]> {
    try {
      const scores = await this.#provider.getScoresByWeek(season, week);
      const gameIds: string[] = [];

      for (const score of scores) {
        try {
          const gameId = await this.ingestGamePlayByPlay(score.GlobalGameID);
          gameIds.push(gameId);

          // Link to competition if specified
          if (competitionId) {
            await this.#competitionGamesRepo.create({
              competitionId,
              gameId,
            });
          }
        } catch (error) {
          this.#logger.error(
            { error, globalGameId: score.GlobalGameID, gameKey: score.GameKey },
            "Error ingesting game",
          );
          // Continue with other games
        }
      }

      this.#logger.info(
        { season, week, ingestedCount: gameIds.length },
        "Ingested games for week",
      );

      return gameIds;
    } catch (error) {
      this.#logger.error({ error, season, week }, "Error ingesting week");
      throw error;
    }
  }
}
