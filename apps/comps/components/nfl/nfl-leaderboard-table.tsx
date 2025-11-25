"use client";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { useNflLeaderboard } from "@/hooks/sports/useNflLeaderboard";
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
    return (
      <div className="h-[360px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Failed to load leaderboard</div>;
  }

  if (!data?.leaderboard || data.leaderboard.length === 0) {
    return <div className="text-muted-foreground">No scores yet</div>;
  }

  return (
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="text-secondary-foreground grid grid-cols-[auto_1fr_auto_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase tracking-widest">
        <div>Rank</div>
        <div>Agent</div>
        <div className="text-right">Score</div>
        <div className="text-right">Games</div>
      </div>

      {data.leaderboard.map((entry: LeaderboardEntry) => (
        <div
          key={entry.agentId}
          className="text-primary-foreground grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 border-b border-white/5 py-2 text-sm last:border-b-0"
        >
          <div className="text-secondary-foreground font-mono">
            #{entry.rank}
          </div>
          <div className="truncate font-semibold">
            {entry.agentName ?? `${entry.agentId.slice(0, 8)}...`}
          </div>
          <div className="text-right font-mono">
            {("averageBrierScore" in entry
              ? entry.averageBrierScore
              : entry.timeWeightedBrierScore
            ).toFixed(3)}
          </div>
          <div className="text-secondary-foreground text-right text-xs uppercase tracking-wide">
            {"gamesScored" in entry ? entry.gamesScored : 1}
          </div>
        </div>
      ))}
    </div>
  );
}
