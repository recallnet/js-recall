"use client";

import { formatDistanceToNow } from "date-fns";
import { Info } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { useNflPredictions } from "@/hooks/sports/useNflPredictions";
import { NflPrediction } from "@/types/nfl";

interface PredictionsTableProps {
  competitionId: string;
  gameId: string;
  agentId?: string;
}

export function PredictionsTable({
  competitionId,
  gameId,
  agentId,
}: PredictionsTableProps) {
  const { data, isLoading, error } = useNflPredictions(
    competitionId,
    gameId,
    agentId,
  );
  const [selectedPrediction, setSelectedPrediction] =
    useState<NflPrediction | null>(null);

  if (isLoading) {
    return (
      <div className="h-[360px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return <div className="text-destructive">Failed to load predictions</div>;
  }
  if (!data?.predictions || data.predictions.length === 0) {
    return (
      <div className="flex h-[360px] items-center justify-center">
        <p className="text-sm text-gray-400">
          No predictions yet for this game
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="text-secondary-foreground border-border grid grid-cols-5 gap-4 border-b pb-2 text-xs font-semibold uppercase tracking-widest">
          <div className="col-span-1">Agent</div>
          <div className="col-span-1">Winner</div>
          <div className="col-span-1 text-right">Confidence</div>
          <div className="col-span-1 text-right">Reason</div>
          <div className="col-span-1 text-right">Time</div>
        </div>

        {data.predictions.map((prediction: NflPrediction) => {
          const agentLabel =
            prediction.agentName ?? `${prediction.agentId.slice(0, 8)}...`;

          return (
            <div
              key={prediction.id}
              className="text-primary-foreground grid min-h-12 grid-cols-5 items-center gap-4 border-b border-white/5 py-2 text-sm last:border-b-0"
            >
              <div className="text-secondary-foreground col-span-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase tracking-wide">
                {agentLabel}
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <span className="font-semibold">
                  {prediction.predictedWinner}
                </span>
              </div>
              <div className="col-span-1 text-right font-mono text-sm">
                {(prediction.confidence * 100).toFixed(0)}%
              </div>
              <div className="col-span-1 text-center">
                {prediction.reason && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-border ml-4 h-5 w-5 shrink-0 border-none p-0 transition-colors duration-200"
                    onClick={() => setSelectedPrediction(prediction)}
                  >
                    <Info className="h-5 w-5" />
                  </Button>
                )}
              </div>
              <div className="text-secondary-foreground col-span-1 text-right text-xs leading-tight">
                {formatDistanceToNow(new Date(prediction.createdAt), {
                  addSuffix: true,
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Prediction Reason Modal */}
      <Dialog
        open={!!selectedPrediction}
        onOpenChange={(open) => !open && setSelectedPrediction(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agent Reasoning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            {selectedPrediction && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-secondary-foreground text-xs uppercase">
                      Agent
                    </p>
                    <p className="font-semibold">
                      {selectedPrediction.agentName ??
                        `${selectedPrediction.agentId.slice(0, 8)}...`}
                    </p>
                  </div>
                  <div>
                    <p className="text-secondary-foreground text-xs uppercase">
                      Prediction
                    </p>
                    <p className="font-semibold">
                      {selectedPrediction.predictedWinner}
                    </p>
                  </div>
                  <div>
                    <p className="text-secondary-foreground text-xs uppercase">
                      Confidence
                    </p>
                    <p className="font-mono">
                      {(selectedPrediction.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-secondary-foreground text-xs uppercase">
                      Time
                    </p>
                    <p className="text-xs">
                      {formatDistanceToNow(
                        new Date(selectedPrediction.createdAt),
                        {
                          addSuffix: true,
                        },
                      )}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-secondary-foreground mb-2 text-xs uppercase">
                    Reasoning
                  </p>
                  <p className="text-primary-foreground leading-relaxed">
                    {selectedPrediction.reason || "No reason provided"}
                  </p>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
