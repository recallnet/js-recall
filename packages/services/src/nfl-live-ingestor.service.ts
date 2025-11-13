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
        `Error ingesting play-by-play for game ${globalGameId}:`,
        error,
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
   */
  async #ingestPlays(
    data: SportsDataIOPlayByPlay,
    gameId: string,
    lockOffsetMs: number,
  ): Promise<void> {
    const gameStartTime = new Date(data.Score.Date);
    let ingestedCount = 0;
    let skippedCount = 0;

    for (const play of data.Plays) {
      try {
        // Only ingest predictable plays
        if (!SportsDataIONflProvider.isPlayPredictable(play)) {
          skippedCount++;
          continue;
        }

        // Calculate lock time
        const lockTime = SportsDataIONflProvider.calculateLockTime(
          play,
          gameStartTime,
          lockOffsetMs,
        );

        // Determine outcome
        const actualOutcome = SportsDataIONflProvider.determineOutcome(play);

        // Determine status based on lock time
        const now = new Date();
        let status: "open" | "locked" | "resolved";
        if (actualOutcome !== null) {
          status = "resolved";
        } else if (now >= lockTime) {
          status = "locked";
        } else {
          status = "open";
        }

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
          status,
          actualOutcome,
        });

        ingestedCount++;
      } catch (error) {
        this.#logger.error(
          `Error ingesting play ${play.Sequence} for game ${gameId}:`,
          error,
        );
        // Continue with other plays
      }
    }

    this.#logger.info(
      `Ingested ${ingestedCount} predictable plays for game ${gameId} (skipped ${skippedCount} non-predictable plays)`,
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
            `Error ingesting game ${score.GlobalGameID} (${score.GameKey}):`,
            error,
          );
          // Continue with other games
        }
      }

      this.#logger.info(
        `Ingested ${gameIds.length} games for ${season} week ${week}`,
      );

      return gameIds;
    } catch (error) {
      this.#logger.error(`Error ingesting week ${season} W${week}:`, error);
      throw error;
    }
  }
}
