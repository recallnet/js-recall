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
 * The full list of possible game statuses for NFL games from SportsDataIO.
 */
export const SportsDataIOGameStatus = z.enum([
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

export type SportsDataIOGameStatus = z.infer<typeof SportsDataIOGameStatus>;

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
  Status: SportsDataIOGameStatus;
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
  GameEndDateTime: string | null;
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
  Status: SportsDataIOGameStatus;
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

    this.#client = axios.create({
      baseURL: this.#baseUrl,
      timeout: 10000,
    });
  }

  /**
   * Get play-by-play data for a specific game
   * @param providerGameId provider game identifier (e.g., 19068)
   * @returns Play-by-play data including score and plays
   */
  async getPlayByPlay(providerGameId: number): Promise<SportsDataIOPlayByPlay> {
    try {
      this.#logger.debug(`Fetching play-by-play for game ${providerGameId}`);

      const response = await this.#client.get<SportsDataIOPlayByPlay>(
        `/pbp/json/playbyplay/${providerGameId}?key=${this.#apiKey}`,
      );

      this.#logger.info(
        `Fetched ${response.data.Plays.length} plays for game ${providerGameId}`,
      );

      return response.data;
    } catch (error) {
      this.#logger.error(
        { error, providerGameId },
        "Error fetching play-by-play for game",
      );
      throw error;
    }
  }

  /**
   * Get schedule for a specific season
   * @param season Year (e.g., "2025" or "2025reg"), defaults to the current 2025 season
   * @returns Array of games
   */
  async getSchedule(
    season: string = "2025",
  ): Promise<SportsDataIOScheduleGame[]> {
    try {
      this.#logger.debug({ season }, "Fetching schedule for season");

      const response = await this.#client.get<SportsDataIOScheduleGame[]>(
        // Note: `stats` or `scores` provide the same response. B ut, if you use the "replay" API
        // during testing, only `stats` is supported. The `scores` is in the documentation, though.
        `/stats/json/schedules/${season}?key=${this.#apiKey}`,
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
