import { AdminGetPerformanceReportsQuerySchema } from "@recallnet/services/types";

import { adminBase } from "@/rpc/context/admin";
import { adminMiddleware } from "@/rpc/middleware/admin";
import { errorHandlerMiddleware } from "@/rpc/middleware/error-handler";


/**
 * Get performance report for a competition
 */
export const getPerformanceReport = adminBase
  .use(errorHandlerMiddleware)
  .use(adminMiddleware)
  .input(AdminGetPerformanceReportsQuerySchema)
  .route({
    method: "GET",
    path: "/admin/reports/performance",
    summary: "Get performance report",
    description: "Get comprehensive performance report for a competition",
    tags: ["admin"],
  })
  .handler(async ({ input, context, errors }) => {
    // Check if competition exists
    const competition = await context.competitionService.getCompetition(
      input.competitionId,
    );
    if (!competition) {
      throw errors.NOT_FOUND({ message: "Competition not found" });
    }

    // Get leaderboard for the competition
    const leaderboard = await context.competitionService.getLeaderboard(
      input.competitionId,
    );

    // Get all users for agent owner names
    const users = await context.userService.getAllUsers();

    // Map agent IDs to owner names
    const userMap = new Map(
      users.map((user) => [user.id, user.name || "Unknown User"]),
    );

    // Get only agents in this competition to map agent IDs to agent names and owners
    const agentIds = leaderboard.map((entry) => entry.agentId);
    const agents = await context.agentService.getAgentsByIds(agentIds);
    const agentMap = new Map(
      agents.map((agent) => [
        agent.id,
        {
          name: agent.name,
          handle: agent.handle,
          ownerName: userMap.get(agent.ownerId) || "Unknown Owner",
        },
      ]),
    );

    // Format leaderboard with agent and owner names
    const formattedLeaderboard = leaderboard.map((entry, index) => ({
      rank: index + 1,
      agentId: entry.agentId,
      agentName: agentMap.get(entry.agentId)?.name || "Unknown Agent",
      agentHandle: agentMap.get(entry.agentId)?.handle || "unknown_agent",
      ownerName: agentMap.get(entry.agentId)?.ownerName || "Unknown Owner",
      portfolioValue: entry.value,
      pnl: entry.pnl,
      // Spot live metrics (only present for spot_live_trading competitions)
      simpleReturn: entry.simpleReturn ?? null,
      startingValue: entry.startingValue ?? null,
      currentValue: entry.currentValue ?? null,
      totalTrades: entry.totalTrades ?? null,
    }));

    return {
      success: true,
      competition,
      leaderboard: formattedLeaderboard,
    };
  });

export type GetPerformanceReportType = typeof getPerformanceReport;
