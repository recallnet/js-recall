import axios, { AxiosInstance } from "axios";
import { Logger } from "pino";
import { z } from "zod";

import { NflTeam } from "@recallnet/db/schema/sports/types";

/**
 * The full list of possible play types for NFL games.
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
 * The full list of possible game statuses for NFL games.
 */
export const GameStatus = z.enum([
  "Scheduled",
  "InProgress",
  "Final",
  "F/OT",
  "Suspended",
  "Postponed",
  "Delayed",
  "Canceled",
  "Forfeit",
]);

export type GameStatus = z.infer<typeof GameStatus>;

/**
 * SportsDataIO Schedule Game response
 */
export interface SportsDataIOScheduleGame {
  GameKey: string;
  GlobalGameID: number;
  SeasonType: number;
  Season: number;
  Week: number;
  Date: string;
  AwayTeam: NflTeam;
  HomeTeam: NflTeam;
  Channel: string | null;
  PointSpread: number | null;
  OverUnder: number | null;
  StadiumID: number;
  Canceled: boolean;
  Status: GameStatus;
  IsClosed: boolean | null;
  DateTimeUTC: string;
  StadiumDetails: {
    StadiumID: number;
    Name: string;
    City: string;
    State: string;
    Country: string;
    Capacity: number;
    PlayingSurface: string;
    GeoLat: number;
    GeoLong: number;
    Type: string;
  };
}

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
  AwayTeam: NflTeam;
  HomeTeam: NflTeam;
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
  Status: GameStatus;
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
  Team: NflTeam;
  Opponent: NflTeam;
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
   * Get schedule for a specific season
   * @param season Year (e.g., 2025), defaults to the current 2025 season
   * @returns Array of games
   */
  async getSchedule(
    season: number = 2025,
  ): Promise<SportsDataIOScheduleGame[]> {
    try {
      this.#logger.debug({ season }, "Fetching schedule for season");

      const response = await this.#client.get<SportsDataIOScheduleGame[]>(
        `/nfl/scores/json/Schedules/${season}`,
      );

      this.#logger.info(
        { season, fetchedCount: response.data.length },
        "Fetched schedule for season",
      );

      return response.data;
    } catch (error) {
      this.#logger.error(
        { error, season },
        "Error fetching schedule for season",
      );
      throw error;
    }
  }
}
