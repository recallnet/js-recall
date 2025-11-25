"use client";

import { format } from "date-fns";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { CHART_COLORS } from "@/components/timeline-chart/constants";
import { useNflPredictions } from "@/hooks/sports/useNflPredictions";
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

  const { chartData, agentIds, agentLabels } = useMemo(() => {
    if (!game || !predictionsData?.predictions?.length) {
      return {
        chartData: [] as TimelinePoint[],
        agentIds: [] as string[],
        agentLabels: new Map<string, string>(),
      };
    }

    const agentLabelsMap = new Map<string, string>();
    predictionsData.predictions.forEach((prediction) => {
      if (!agentLabelsMap.has(prediction.agentId)) {
        agentLabelsMap.set(
          prediction.agentId,
          prediction.agentName ?? `${prediction.agentId.slice(0, 8)}...`,
        );
      }
    });

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

    // Add intermediate timestamps for smoother visualization
    const enhancedTimestamps: number[] = [];
    for (let i = 0; i < sortedTimestamps.length - 1; i++) {
      const current = sortedTimestamps[i];
      const next = sortedTimestamps[i + 1];
      if (current === undefined || next === undefined) continue;

      enhancedTimestamps.push(current);
      const gap = next - current;
      // Add intermediate points if gap is large (> 30 minutes)
      if (gap > 30 * 60 * 1000) {
        const numIntermediate = Math.min(Math.floor(gap / (30 * 60 * 1000)), 3);
        for (let j = 1; j <= numIntermediate; j++) {
          enhancedTimestamps.push(current + (gap * j) / (numIntermediate + 1));
        }
      }
    }
    const lastTimestamp = sortedTimestamps[sortedTimestamps.length - 1];
    if (lastTimestamp !== undefined) {
      enhancedTimestamps.push(lastTimestamp);
    }

    const agentStates = new Map<string, { index: number; latest?: number }>();
    predictionsByAgent.forEach((_, agentId) => {
      agentStates.set(agentId, { index: -1, latest: undefined });
    });

    const result: TimelinePoint[] = [];
    enhancedTimestamps.forEach((timestamp: number) => {
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
          // Map to -100 to +100 scale: home team positive, away team negative
          const isHomeTeam = nextPrediction.predictedWinner === game.homeTeam;
          state.latest = isHomeTeam
            ? nextPrediction.confidence * 100
            : -nextPrediction.confidence * 100;
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
      agentLabels: agentLabelsMap,
    };
  }, [game, predictionsData]);

  const renderEmptyState = (message: string, isError?: boolean) => (
    <div
      className={cn(
        "h-120 flex items-center justify-center text-sm",
        isError ? "text-destructive" : "text-muted-foreground",
      )}
    >
      {message}
    </div>
  );

  if (!game) {
    return renderEmptyState("Select a game to view prediction trends.");
  }

  if (isLoading) {
    return (
      <div className="h-120">
        <Skeleton className="h-full w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return renderEmptyState("Failed to load predictions for this game.", true);
  }

  if (!chartData.length || agentIds.length === 0) {
    return renderEmptyState("No predictions yet for this game.");
  }

  return (
    <div className="h-120 relative overflow-hidden [&_svg:focus]:outline-none">
      {/* Team y-axis labels */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full flex-col justify-between py-4 pl-2">
        <div className="text-secondary-foreground text-xs font-semibold uppercase leading-tight">
          <div className="flex flex-col">
            <span>{game.homeTeam}</span>
            <span>win %</span>
          </div>
        </div>
        <div className="text-secondary-foreground mb-10 text-xs font-semibold uppercase leading-tight">
          <div className="flex flex-col">
            <span>{game.awayTeam}</span>
            <span>win %</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ right: 30, bottom: 5, top: 20, left: 45 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <ReferenceLine
            y={0}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="label"
            stroke="var(--secondary-foreground)"
            fontSize={12}
            tick={{ fill: "var(--secondary-foreground)" }}
            tickMargin={10}
            minTickGap={20}
          />
          <YAxis
            stroke="var(--secondary-foreground)"
            fontSize={12}
            tick={{ fill: "var(--secondary-foreground)" }}
            domain={[-100, 100]}
            ticks={[-100, -75, -50, -25, 0, 25, 50, 75, 100]}
            tickFormatter={(value) => `${Math.abs(value)}%`}
          />
          <Tooltip
            formatter={(value: number) => {
              const team = value > 0 ? game.homeTeam : game.awayTeam;
              return `${team}: ${Math.abs(value).toFixed(0)}%`;
            }}
            contentStyle={{
              backgroundColor: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
            }}
            labelStyle={{ color: "var(--secondary-foreground)" }}
          />
          <Legend
            wrapperStyle={{ paddingTop: 12 }}
            iconType="circle"
            formatter={(value: string) =>
              agentLabels.get(value) ?? value.slice(0, 8)
            }
          />

          {agentIds.map((agentId, index) => (
            <Line
              key={agentId}
              type="stepAfter"
              dataKey={agentId}
              name={agentLabels.get(agentId) ?? agentId.slice(0, 8)}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2 }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
