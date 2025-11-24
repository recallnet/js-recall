"use client";

import { formatDistanceToNow } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { useNflPredictions } from "@/hooks/useNflPredictions";
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
      <div className="text-muted-foreground">No predictions for this game</div>
    );
  }

  return (
    <>
      <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-4">
        <div className="text-secondary-foreground grid grid-cols-4 gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase tracking-widest">
          <div className="col-span-1">Agent</div>
          <div className="col-span-1">Prediction</div>
          <div className="col-span-1 text-right">Confidence</div>
          <div className="col-span-1 text-right">Time</div>
        </div>

        {data.predictions.map((prediction: NflPrediction) => {
          const agentLabel =
            prediction.agentName ?? `${prediction.agentId.slice(0, 8)}...`;

          return (
            <div
              key={prediction.id}
              className="text-primary-foreground grid min-h-12 grid-cols-4 items-center gap-4 border-b border-white/5 py-2 text-sm last:border-b-0"
            >
              <div className="text-secondary-foreground col-span-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs uppercase tracking-wide">
                {agentLabel}
              </div>
              <div className="col-span-1 flex items-center gap-2">
                <span className="font-semibold">
                  {prediction.predictedWinner}
                </span>
                {prediction.reason && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 shrink-0 p-0 hover:bg-white/10"
                    onClick={() => setSelectedPrediction(prediction)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="col-span-1 text-right font-mono text-sm">
                {(prediction.confidence * 100).toFixed(0)}%
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
