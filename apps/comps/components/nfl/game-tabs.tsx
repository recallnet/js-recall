"use client";

import { format } from "date-fns";

import { NflGame } from "@/types/nfl";

interface GameTabsProps {
  games: NflGame[];
  selectedGameId?: string;
  onSelect(gameId: string): void;
  variant?: "default" | "compact";
}

export function GameTabs({
  games,
  selectedGameId,
  onSelect,
  variant = "default",
}: GameTabsProps) {
  if (!games.length) {
    return (
      <div className="text-muted-foreground text-sm">No games scheduled.</div>
    );
  }

  const baseClasses =
    "min-w-[180px] rounded-lg border px-3 py-2 text-left transition-colors";
  const selectedClasses = "border-primary bg-primary/10 text-primary";
  const idleClasses =
    "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50";

  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-2">
      {games.map((game) => {
        const isSelected = selectedGameId === game.id;
        return (
          <button
            key={game.id}
            type="button"
            className={`${baseClasses} ${
              isSelected ? selectedClasses : idleClasses
            }`}
            onClick={() => onSelect(game.id)}
          >
            <div className="text-[11px] uppercase tracking-wide">
              {game.status.replace("_", " ")}
            </div>
            <div
              className={`font-semibold ${
                variant === "compact" ? "text-sm" : "text-base"
              }`}
            >
              {game.awayTeam} @ {game.homeTeam}
            </div>
            <div className="text-muted-foreground text-[11px]">
              {format(new Date(game.startTime), "MMM d, h:mm a")}
            </div>
          </button>
        );
      })}
    </div>
  );
}
