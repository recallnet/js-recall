import { GetGameInfoType, getGameInfo } from "./get-game-info";
import { GetGamePlaysType, getGamePlays } from "./get-game-plays";
import { GetGamesType, getGames } from "./get-games";
import { GetLeaderboardType, getLeaderboard } from "./get-leaderboard";
import { GetPredictionsType, getPredictions } from "./get-predictions";
import { GetRulesType, getRules } from "./get-rules";
import { PredictWinnerType, predictWinner } from "./predict-winner";

export const router: {
  getGames: GetGamesType;
  getGameInfo: GetGameInfoType;
  getGamePlays: GetGamePlaysType;
  getPredictions: GetPredictionsType;
  predictWinner: PredictWinnerType;
  getLeaderboard: GetLeaderboardType;
  getRules: GetRulesType;
} = {
  getGames,
  getGameInfo,
  getGamePlays,
  getPredictions,
  predictWinner,
  getLeaderboard,
  getRules,
};
