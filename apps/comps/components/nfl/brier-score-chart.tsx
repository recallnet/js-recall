"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { useNflPredictions } from "@/hooks/useNflPredictions";
import { NflGame, NflPrediction } from "@/types/nfl";

interface BrierScoreChartProps {
  competitionId: string;
  game?: NflGame;
}

type TimelinePoint = {
  timestamp: number;
  label: string;
} & Record<string, number | string>;

export function BrierScoreChart({ competitionId, game }: BrierScoreChartProps) {
  const gameId = game?.id;
  const {
    data: predictionsData,
    isLoading,
    error,
  } = useNflPredictions(gameId ? competitionId : undefined, gameId);

  const { chartData, agentIds } = useMemo(() => {
    if (!game || !predictionsData?.predictions?.length) {
      return { chartData: [] as TimelinePoint[], agentIds: [] as string[] };
    }

    const predictionsWithTimestamps = predictionsData.predictions
      .map((prediction) => ({
        ...prediction,
        timestamp: new Date(prediction.createdAt).getTime(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    const predictionsByAgent = new Map<
      string,
      Array<NflPrediction & { timestamp: number }>
    >();
    predictionsWithTimestamps.forEach((prediction) => {
      const existing = predictionsByAgent.get(prediction.agentId) ?? [];
      existing.push(prediction);
      predictionsByAgent.set(prediction.agentId, existing);
    });

    const startTime = new Date(game.startTime).getTime();
    const endTime = game.endTime
      ? new Date(game.endTime).getTime()
      : Math.max(Date.now(), startTime);

    const uniqueTimestamps = new Set<number>([startTime, endTime]);
    predictionsWithTimestamps.forEach((prediction) => {
      uniqueTimestamps.add(prediction.timestamp);
    });

    const sortedTimestamps = Array.from(uniqueTimestamps).sort((a, b) => a - b);

    const agentStates = new Map<string, { index: number; latest?: number }>();
    predictionsByAgent.forEach((_, agentId) => {
      agentStates.set(agentId, { index: -1, latest: undefined });
    });

    const result: TimelinePoint[] = [];
    sortedTimestamps.forEach((timestamp: number) => {
      const point: TimelinePoint = {
        timestamp,
        label: format(new Date(timestamp), "MMM d HH:mm"),
      };

      predictionsByAgent.forEach((agentPredictions, agentId) => {
        const state = agentStates.get(agentId);
        if (!state) return;

        while (state.index + 1 < agentPredictions.length) {
          const nextPrediction = agentPredictions[state.index + 1];
          if (!nextPrediction || nextPrediction.timestamp > timestamp) {
            break;
          }
          state.index += 1;
          state.latest =
            nextPrediction.predictedWinner === game.homeTeam
              ? nextPrediction.confidence
              : 1 - nextPrediction.confidence;
        }

        if (state.latest !== undefined) {
          point[agentId] = state.latest;
        }
      });

      const hasValues = Array.from(predictionsByAgent.keys()).some(
        (agentId) => typeof point[agentId] === "number",
      );

      if (hasValues) {
        result.push(point);
      }
    });

    return {
      chartData: result,
      agentIds: Array.from(predictionsByAgent.keys()),
    };
  }, [game, predictionsData]);

  if (!game) {
    return (
      <div className="text-muted-foreground flex h-[360px] items-center justify-center text-sm">
        Select a game to view prediction trends.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-[360px]">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive flex h-[360px] items-center justify-center text-sm">
        Failed to load predictions for this game.
      </div>
    );
  }

  if (!chartData.length || agentIds.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[360px] items-center justify-center text-sm">
        No predictions yet for this game.
      </div>
    );
  }

  const colors = [
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
  ];

  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="label"
          stroke="#888"
          style={{ fontSize: "12px" }}
          tick={{ fill: "#888" }}
        />
        <YAxis
          stroke="#888"
          style={{ fontSize: "12px" }}
          tick={{ fill: "#888" }}
          domain={[0, 1]}
          tickFormatter={(value) => `${Math.round(value * 100)}%`}
          label={{
            value: `${game.homeTeam} win probability`,
            angle: -90,
            position: "insideLeft",
            style: { fill: "#888" },
          }}
        />
        <Tooltip
          formatter={(value: number) => `${(value * 100).toFixed(0)}%`}
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#888" }}
        />
        <Legend wrapperStyle={{ paddingTop: "12px" }} />

        {agentIds.map((agentId, index) => (
          <Line
            key={agentId}
            type="stepAfter"
            dataKey={agentId}
            name={agentId.slice(0, 8)}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
