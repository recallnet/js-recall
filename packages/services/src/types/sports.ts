import { z } from "zod";

import { NflTeam } from "@recallnet/db/schema/sports/types";

/**
 * Configuration for sports providers
 */
export interface SportsProviderConfig {
  apiKey: string;
  baseUrl?: string;
}

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
  AwayTeamMoneyLine: number | null;
  HomeTeamMoneyLine: number | null;
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
  DateTimeUTC: string;
  GameEndDateTime: string | null;
  AwayTeam: NflTeam;
  HomeTeam: NflTeam;
  AwayScore: number | null;
  HomeScore: number | null;
  AwayTeamMoneyLine: number | null;
  HomeTeamMoneyLine: number | null;
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
