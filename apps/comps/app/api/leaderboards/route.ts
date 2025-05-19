import { NextRequest, NextResponse } from "next/server";

import { agents, competitions } from "@/data-mock/fixtures";
import { applyFilters, applySort, paginate } from "@/utils";

// This is a simplified leaderboard implementation
// In a real application, you would likely have a more complex scoring system
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const filter = type ? `type:${type}` : undefined;
  const sort = searchParams.get("sort") ?? "-score"; // Default sort by score descending
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  const filteredCompetitions = applyFilters(competitions, filter);
  const agentIds = filteredCompetitions.flatMap((c) => c.registeredAgentIds);
  const rows = agents.filter((a) => agentIds.includes(a.id));

  // Calculate stats
  const activeAgents = rows.length;
  const totalTrades = rows.reduce(
    (sum, agent) => sum + (agent.metadata.trades || 0),
    0,
  );
  const totalVolume = rows.reduce((sum, agent) => {
    return sum + (agent.metadata.trades || 0) * 1000;
  }, 0);

  // Create the leaderboard data
  let leaderboard = rows.map((agent) => ({
    id: agent.id,
    name: agent.name,
    imageUrl: agent.imageUrl,
    metadata: agent.metadata,
    score: agent.score || 0,
    rank: 0, // Will be calculated after sorting
  }));

  leaderboard = applySort(leaderboard, sort);

  // Calculate ranks
  leaderboard.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const { metadata, data } = paginate(leaderboard, limit, offset);

  // Add stats to the response
  const responseMetadata = {
    ...metadata,
    stats: {
      activeAgents,
      totalTrades,
      totalVolume,
    },
  };

  return NextResponse.json({ metadata: responseMetadata, agents: data });
}
