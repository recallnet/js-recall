import { getGlobalStats } from "@/database/repositories/leaderboard-repository.js";
import { CompetitionType } from "@/types/index.js";

/**
 * Leaderboard Service
 * Handles leaderboard data for all competitions
 */
export class LeaderboardService {
  /**
   * Get global leaderboard data across all relevant competitions.
   * @param params Object containing type, limit, and offset.
   * @returns Aggregated leaderboard data including stats and ranked agents
   */
  async getGlobalStats(type: CompetitionType) {
    console.log("[LeaderboardService] getGlobalStats for type:", type);

    // Fetch global statistics and ranked agents
    return await getGlobalStats(type);
  }
}
