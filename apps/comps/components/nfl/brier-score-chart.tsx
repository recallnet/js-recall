"use client";

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

import { useNflGames } from "@/hooks/useNflGames";
import { AgentScoreData } from "@/types/nfl";

interface BrierScoreChartProps {
  competitionId: string;
  agentScores: AgentScoreData[];
}

export function BrierScoreChart({
  competitionId,
  agentScores,
}: BrierScoreChartProps) {
  const { data: gamesData } = useNflGames(competitionId);

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!gamesData?.games || agentScores.length === 0) return [];

    // Get all unique game times
    const gameTimes = new Set<string>();
    agentScores.forEach((agent) => {
      agent.gameScores.forEach((score) => {
        gameTimes.add(score.gameStartTime);
      });
    });

    const sortedTimes = Array.from(gameTimes).sort();

    // Calculate running average for each agent at each game
    return sortedTimes.map((time, index) => {
      const dataPoint: Record<string, string | number> = {
        time: new Date(time).toLocaleDateString(),
        gameIndex: index + 1,
      };

      agentScores.forEach((agent) => {
        // Get scores up to this game
        const scoresUpToNow = agent.gameScores
          .filter((s) => new Date(s.gameStartTime) <= new Date(time))
          .map((s) => s.timeWeightedBrierScore);

        if (scoresUpToNow.length > 0) {
          const runningAverage =
            scoresUpToNow.reduce((sum, score) => sum + score, 0) /
            scoresUpToNow.length;
          dataPoint[agent.agentId] = runningAverage;
        }
      });

      return dataPoint;
    });
  }, [agentScores, gamesData]);

  if (chartData.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[400px] items-center justify-center">
        No data available yet
      </div>
    );
  }

  // Colors for different agents
  const colors = [
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#3b82f6",
    "#ef4444",
  ];

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis
          dataKey="time"
          stroke="#888"
          style={{ fontSize: "12px" }}
          tick={{ fill: "#888" }}
        />
        <YAxis
          stroke="#888"
          style={{ fontSize: "12px" }}
          tick={{ fill: "#888" }}
          domain={[0, 1]}
          label={{
            value: "Average Brier Score",
            angle: -90,
            position: "insideLeft",
            style: { fill: "#888" },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1a1a1a",
            border: "1px solid #333",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#888" }}
        />
        <Legend wrapperStyle={{ paddingTop: "20px" }} />

        {agentScores.map((agent, index) => (
          <Line
            key={agent.agentId}
            type="monotone"
            dataKey={agent.agentId}
            name={agent.agentName || agent.agentId.slice(0, 8)}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
