"use client";

import { formatDistanceToNow } from "date-fns";

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
    <div className="space-y-2 rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="text-secondary-foreground grid grid-cols-[1fr_80px_100px_120px] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase tracking-widest">
        <div>Agent</div>
        <div>Prediction</div>
        <div className="text-right">Confidence</div>
        <div className="text-right">Time</div>
      </div>

      {data.predictions.map((prediction: NflPrediction) => {
        const agentLabel =
          prediction.agentName ?? `${prediction.agentId.slice(0, 8)}...`;

        return (
          <div
            key={prediction.id}
            className="text-primary-foreground grid grid-cols-[1fr_80px_100px_120px] items-center gap-4 border-b border-white/5 py-2 text-sm last:border-b-0"
          >
            <div className="text-secondary-foreground truncate text-xs uppercase tracking-wide">
              {agentLabel}
            </div>
            <div className="font-semibold">{prediction.predictedWinner}</div>
            <div className="text-right font-mono text-sm">
              {(prediction.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-secondary-foreground text-right text-xs">
              {formatDistanceToNow(new Date(prediction.createdAt), {
                addSuffix: true,
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
