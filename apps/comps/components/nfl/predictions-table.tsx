"use client";

import { formatDistanceToNow } from "date-fns";

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
    return <div className="text-muted-foreground">Loading predictions...</div>;
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
    <div className="space-y-2">
      <div className="text-muted-foreground grid grid-cols-[1fr_80px_100px_120px] gap-4 border-b pb-2 text-sm font-medium">
        <div>Agent</div>
        <div>Prediction</div>
        <div className="text-right">Confidence</div>
        <div className="text-right">Time</div>
      </div>

      {data.predictions.map((prediction: NflPrediction) => (
        <div
          key={prediction.id}
          className="border-border/50 grid grid-cols-[1fr_80px_100px_120px] items-center gap-4 border-b py-2 text-sm"
        >
          <div className="text-muted-foreground truncate text-xs">
            {prediction.agentId.slice(0, 8)}...
          </div>
          <div className="font-medium">{prediction.predictedWinner}</div>
          <div className="text-right font-mono">
            {(prediction.confidence * 100).toFixed(0)}%
          </div>
          <div className="text-muted-foreground text-right text-xs">
            {formatDistanceToNow(new Date(prediction.createdAt), {
              addSuffix: true,
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
