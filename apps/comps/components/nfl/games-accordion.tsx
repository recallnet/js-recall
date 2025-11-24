"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";

import { NflGame } from "@/types/nfl";

interface GamesAccordionProps {
  games: NflGame[];
  selectedGameId?: string;
  onSelectGame?: (gameId: string, goToPredictions?: boolean) => void;
}

export function GamesAccordion({
  games,
  selectedGameId,
  onSelectGame,
}: GamesAccordionProps) {
  const [openGameId, setOpenGameId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedGameId) {
      return;
    }

    setOpenGameId((current) => current ?? selectedGameId);
  }, [selectedGameId]);

  if (!games.length) {
    return (
      <div className="text-muted-foreground text-sm">No games scheduled.</div>
    );
  }

  return (
    <div className="space-y-3">
      {games.map((game) => {
        const isOpen = openGameId === game.id;
        const isSelected = selectedGameId === game.id;

        return (
          <div
            key={game.id}
            className={`rounded-lg border ${
              isSelected ? "border-primary" : "border-border"
            }`}
          >
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left"
              onClick={() =>
                setOpenGameId((current) =>
                  current === game.id ? null : game.id,
                )
              }
            >
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span>{game.awayTeam}</span>
                  <span className="text-muted-foreground">@</span>
                  <span>{game.homeTeam}</span>
                </div>
                <div className="text-muted-foreground text-[11px] uppercase tracking-wide">
                  {game.status.replace("_", " ")} &middot;{" "}
                  {format(new Date(game.startTime), "MMM d, h:mm a")}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs">
                {game.winner && (
                  <span className="text-primary font-semibold">
                    Winner: {game.winner}
                  </span>
                )}
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    game.status === "in_progress"
                      ? "bg-green-500/10 text-green-400"
                      : game.status === "final"
                        ? "bg-muted text-muted-foreground"
                        : "bg-blue-500/10 text-blue-300"
                  }`}
                >
                  {game.status.replace("_", " ")}
                </span>
              </div>
            </button>

            {isOpen && (
              <div className="border-t px-4 py-4 text-sm">
                <div className="space-y-2">
                  {(game.spread !== null || game.overUnder !== null) && (
                    <div className="flex flex-wrap gap-4 text-xs">
                      {game.spread !== null && (
                        <div>
                          <span className="text-muted-foreground">Spread:</span>{" "}
                          <span className="font-mono">
                            {game.spread > 0 ? "+" : ""}
                            {game.spread}
                          </span>
                        </div>
                      )}
                      {game.overUnder !== null && (
                        <div>
                          <span className="text-muted-foreground">O/U:</span>{" "}
                          <span className="font-mono">{game.overUnder}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {game.venue && (
                    <div className="text-muted-foreground text-xs">
                      Venue: {game.venue}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="border-border hover:bg-muted/50 rounded-md border px-3 py-1 text-xs font-medium uppercase"
                    onClick={() => onSelectGame?.(game.id)}
                  >
                    View chart
                  </button>
                  <button
                    type="button"
                    className="bg-primary rounded-md px-3 py-1 text-xs font-medium uppercase text-black"
                    onClick={() => onSelectGame?.(game.id, true)}
                  >
                    View predictions
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
