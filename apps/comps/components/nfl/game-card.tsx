"use client";

import { format } from "date-fns";

import { useNflGameInfo } from "@/hooks/useNflGameInfo";

interface GameCardProps {
  competitionId: string;
  gameId: string;
}

export function GameCard({ competitionId, gameId }: GameCardProps) {
  const { data, isLoading, error } = useNflGameInfo(competitionId, gameId);

  if (isLoading) {
    return (
      <div className="border-border animate-pulse rounded-lg border p-4">
        <div className="bg-muted h-20 rounded" />
      </div>
    );
  }

  if (error || !data?.game) {
    return (
      <div className="border-destructive/50 rounded-lg border p-4">
        <div className="text-destructive text-sm">Failed to load game</div>
      </div>
    );
  }

  const { game } = data;
  const isLive = game.status === "in_progress";
  const isFinal = game.status === "final";

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      {/* Status Badge */}
      <div className="flex items-center justify-between">
        <div
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            isLive
              ? "bg-green-500/10 text-green-500"
              : isFinal
                ? "bg-muted text-muted-foreground"
                : "bg-blue-500/10 text-blue-500"
          }`}
        >
          {game.status.toUpperCase()}
        </div>
        <div className="text-muted-foreground text-xs">
          {format(new Date(game.startTime), "MMM d, h:mm a")}
        </div>
      </div>

      {/* Matchup */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-lg font-bold">{game.awayTeam}</div>
          <div className="text-muted-foreground text-xs">Away</div>
        </div>

        <div className="text-muted-foreground px-4 text-2xl font-bold">@</div>

        <div className="flex-1 text-right">
          <div className="text-lg font-bold">{game.homeTeam}</div>
          <div className="text-muted-foreground text-xs">Home</div>
        </div>
      </div>

      {/* Winner (if final) */}
      {isFinal && game.winner && (
        <div className="text-center text-sm">
          <span className="text-muted-foreground">Winner: </span>
          <span className="text-primary font-bold">{game.winner}</span>
        </div>
      )}

      {/* Betting Lines */}
      {(game.spread !== null || game.overUnder !== null) && (
        <div className="flex items-center justify-center gap-4 text-xs">
          {game.spread !== null && (
            <div>
              <span className="text-muted-foreground">Spread: </span>
              <span className="font-mono">
                {game.spread > 0 ? "+" : ""}
                {game.spread}
              </span>
            </div>
          )}
          {game.overUnder !== null && (
            <div>
              <span className="text-muted-foreground">O/U: </span>
              <span className="font-mono">{game.overUnder}</span>
            </div>
          )}
        </div>
      )}

      {/* Venue */}
      {game.venue && (
        <div className="text-muted-foreground text-center text-xs">
          {game.venue}
        </div>
      )}
    </div>
  );
}
