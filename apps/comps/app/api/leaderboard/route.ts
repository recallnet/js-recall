import { NextRequest, NextResponse } from "next/server";

import { agents } from "@/data-mock/fixtures";
import { applyFilters, applySort, paginate } from "@/utils";

// This is a simplified leaderboard implementation
// In a real application, you would likely have a more complex scoring system
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? undefined;
  const sort = searchParams.get("sort") ?? "-score"; // Default sort by score descending
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  // Generate a score for each agent based on the number of competitions they've joined
  const leaderboard = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    avatarUrl: agent.avatarUrl,
    score: agent.competitions.length * 100,
    rank: 0, // Will be calculated after sorting
    competitions: agent.competitions.length,
  }));

  let rows = leaderboard;
  rows = applyFilters(rows, filter);
  rows = applySort(rows, sort);

  // Calculate ranks
  rows.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, leaderboard: data });
}
