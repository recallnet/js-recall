"use client";

import { useNflLeaderboard } from "@/hooks/useNflLeaderboard";
import { LeaderboardEntry } from "@/types/nfl";

interface NflLeaderboardTableProps {
  competitionId: string;
  gameId?: string;
}

export function NflLeaderboardTable({
  competitionId,
  gameId,
}: NflLeaderboardTableProps) {
  const { data, isLoading, error } = useNflLeaderboard(competitionId, gameId);

  if (isLoading) {
    return <div className="text-muted-foreground">Loading leaderboard...</div>;
  }

  if (error) {
    return <div className="text-destructive">Failed to load leaderboard</div>;
  }

  if (!data?.leaderboard || data.leaderboard.length === 0) {
    return <div className="text-muted-foreground">No scores yet</div>;
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b pb-2 text-sm font-medium">
        <div>Rank</div>
        <div>Agent</div>
        <div className="text-right">Score</div>
        <div className="text-right">Games</div>
      </div>

      {data.leaderboard.map((entry: LeaderboardEntry) => (
        <div
          key={entry.agentId}
          className="border-border/50 grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b py-2 text-sm"
        >
          <div className="text-muted-foreground font-mono">#{entry.rank}</div>
          <div className="truncate font-medium">{entry.agentId}</div>
          <div className="text-right font-mono">
            {("averageBrierScore" in entry
              ? entry.averageBrierScore
              : entry.timeWeightedBrierScore
            ).toFixed(3)}
          </div>
          <div className="text-muted-foreground text-right">
            {"gamesScored" in entry ? entry.gamesScored : 1}
          </div>
        </div>
      ))}
    </div>
  );
}
