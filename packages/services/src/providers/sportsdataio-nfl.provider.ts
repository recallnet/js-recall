import axios, { AxiosInstance } from "axios";
import { Logger } from "pino";
import { z } from "zod";

/**
 * The full list of possible play types.
 */
export const NFL_ALL_PLAY_TYPES = z.enum([
  "Rush",
  "PassCompleted",
  "PassIncomplete",
  "PassIntercepted",
  "TwoPointConversion",
  "Punt",
  "Kickoff",
  "FieldGoal",
  "ExtraPoint",
  "Fumble",
  "Penalty",
  "Sack",
  "Timeout",
  "Period",
]);

export type NflPlayType = z.infer<typeof NFL_ALL_PLAY_TYPES>;

/**
 * Predictable play types are only offensive plays. Note: certain defensive or "incomplete" plays
 * are coerced to pass plays.
 */
export const NFL_PREDICTABLE_PLAY_TYPES = z.enum([
  "Rush",
  "PassCompleted",
  "PassIncomplete",
  "PassIntercepted",
]);

export type NflPredictablePlayType = z.infer<typeof NFL_PREDICTABLE_PLAY_TYPES>;
/**
 * Default lock offset in milliseconds (10 seconds). This determines how long after the play starts
 * that predictions from the agent can be submitted.
 */
export const DEFAULT_LOCK_OFFSET_MS = 10_000;

/**
 * SportsDataIO Game Score response
 */
export interface SportsDataIOScore {
  GameKey: string;
  GlobalGameID: number;
  SeasonType: number;
  Season: number;
  Week: number;
  Date: string;
  AwayTeam: string;
  HomeTeam: string;
  AwayScore: number | null;
  HomeScore: number | null;
  Quarter: string | null;
  TimeRemaining: string | null;
  Possession: string | null;
  Down: number | null;
  Distance: string | null;
  YardLine: number | null;
  YardLineTerritory: string | null;
  DownAndDistance: string | null;
  HasStarted: boolean;
  IsInProgress: boolean;
  IsOver: boolean;
  Status: string;
  StadiumDetails: {
    StadiumID: number;
    Name: string;
    City: string;
    State: string;
  };
}

/**
 * SportsDataIO Play response
 */
export interface SportsDataIOPlay {
  PlayID: number;
  QuarterID: number;
  QuarterName: string;
  Sequence: number;
  TimeRemainingMinutes: number;
  TimeRemainingSeconds: number;
  PlayTime: string;
  Updated: string;
  Created: string;
  Team: string;
  Opponent: string;
  Down: number | null;
  Distance: number | null;
  YardLine: number | null;
  YardLineTerritory: string | null;
  YardsToEndZone: number;
  Type: NflPlayType;
  YardsGained: number;
  Description: string;
  IsScoringPlay: boolean;
}

/**
 * SportsDataIO Play-by-Play response
 */
export interface SportsDataIOPlayByPlay {
  Score: SportsDataIOScore;
  Quarters: Array<{
    QuarterID: number;
    Number: number;
    Name: string;
  }>;
  Plays: SportsDataIOPlay[];
}

/**
 * SportsDataIO NFL Provider
 * Fetches live NFL game and play-by-play data
 */
export class SportsDataIONflProvider {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #client: AxiosInstance;
  readonly #logger: Logger;

  constructor(apiKey: string, logger: Logger, baseUrl?: string) {
    this.#apiKey = apiKey;
    this.#baseUrl = baseUrl || "https://api.sportsdata.io/v3/nfl";
    this.#logger = logger;

    // Only add API key header if not using mock server
    const headers: Record<string, string> = {};
    if (!baseUrl || !baseUrl.includes("localhost")) {
      headers["Ocp-Apim-Subscription-Key"] = this.#apiKey;
    }

    this.#client = axios.create({
      baseURL: this.#baseUrl,
      headers,
      timeout: 10000,
    });
  }

  /**
   * Get play-by-play data for a specific game
   * @param globalGameId Global game identifier (e.g., 19068)
   * @returns Play-by-play data including score and plays
   */
  async getPlayByPlay(globalGameId: number): Promise<SportsDataIOPlayByPlay> {
    try {
      this.#logger.debug(`Fetching play-by-play for game ${globalGameId}`);

      const response = await this.#client.get<SportsDataIOPlayByPlay>(
        `/pbp/json/PlayByPlay/${globalGameId}`,
      );

      this.#logger.info(
        `Fetched ${response.data.Plays.length} plays for game ${globalGameId}`,
      );

      return response.data;
    } catch (error) {
      this.#logger.error(
        { error, globalGameId },
        "Error fetching play-by-play for game",
      );
      throw error;
    }
  }

  /**
   * Get scores for games in a specific week
   * @param season Year (e.g., 2025), defaults to the current 2025 season
   * @param week Week number (1-18 for regular season)
   * @returns Array of game scores
   */
  async getScoresByWeek(
    season: number = 2025,
    week: number,
  ): Promise<SportsDataIOScore[]> {
    try {
      this.#logger.debug(`Fetching scores for ${season} week ${week}`);

      const response = await this.#client.get<SportsDataIOScore[]>(
        `/nfl/scores/json/ScoresByWeek/${season}/${week}`,
      );

      this.#logger.info(
        { season, week, fetchedCount: response.data.length },
        "Fetched scores for week",
      );

      return response.data;
    } catch (error) {
      this.#logger.error(
        { error, season, week },
        "Error fetching scores for season week",
      );
      throw error;
    }
  }

  /**
   * Get scores for games in a specific season
   * @param season Year (e.g., 2025), defaults to the current 2025 season
   * @returns Array of game scores
   */
  async getScoresBySeason(season: number = 2025): Promise<SportsDataIOScore[]> {
    try {
      this.#logger.debug({ season }, "Fetching scores for season");

      const response = await this.#client.get<SportsDataIOScore[]>(
        `/nfl/scores/json/Scores/${season}`,
      );

      this.#logger.info(
        { season, fetchedCount: response.data.length },
        "Fetched scores for season",
      );

      return response.data;
    } catch (error) {
      this.#logger.error({ error, season }, "Error fetching scores for season");
      throw error;
    }
  }

  /**
   * Determine if a play is predictable (run vs pass)
   * @param play SportsDataIO play
   * @returns True if play can be predicted
   */
  static isPlayPredictable(play: SportsDataIOPlay): boolean {
    return NFL_PREDICTABLE_PLAY_TYPES.safeParse(play.Type).success;
  }

  /**
   * Determine the outcome of a play
   * @param play SportsDataIO play
   * @returns "run", "pass", or null if not predictable
   */
  static determineOutcome(play: SportsDataIOPlay): "run" | "pass" | null {
    switch (play.Type) {
      // Treat certain defensive or incomplete plays as pass plays
      case "PassCompleted":
      case "PassIncomplete":
      case "PassIntercepted":
      case "Sack":
        return "pass";
      case "Rush":
        return "run";
      default:
        // Kickoff, Punt, Field Goal, Penalty, etc. - not predictable
        return null;
    }
  }

  /**
   * Calculate lock time for a play
   * Uses PlayTime if available, otherwise estimates from game time
   * @param play SportsDataIO play
   * @param gameStartTime Game start time
   * @param lockOffsetMs Milliseconds before play to lock predictions (default: 10 seconds)
   * @returns Lock time for predictions
   */
  static calculateLockTime(
    play: SportsDataIOPlay,
    gameStartTime: Date,
    lockOffsetMs: number = DEFAULT_LOCK_OFFSET_MS,
  ): Date {
    // Option 1: Use PlayTime (most accurate)
    if (play.PlayTime) {
      const playTime = new Date(play.PlayTime);
      return new Date(playTime.getTime() - lockOffsetMs);
    }

    // Option 2: Estimate from game start + quarter + time remaining
    const quarterDuration = 15 * 60 * 1000; // 15 minutes in ms
    const quarterNumber = parseInt(play.QuarterName);
    const quarterOffset = (quarterNumber - 1) * quarterDuration;
    const timeElapsed =
      quarterDuration -
      (play.TimeRemainingMinutes * 60 + play.TimeRemainingSeconds) * 1000;

    const estimatedPlayTime = new Date(
      gameStartTime.getTime() + quarterOffset + timeElapsed,
    );

    return new Date(estimatedPlayTime.getTime() - lockOffsetMs);
  }
}
