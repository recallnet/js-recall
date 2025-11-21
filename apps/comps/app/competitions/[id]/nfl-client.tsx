"use client";

import { useState } from "react";

import { Competition } from "@recallnet/services/types";

import { BrierScoreChart } from "@/components/nfl/brier-score-chart";
import { GameCard } from "@/components/nfl/game-card";
import { NflLeaderboardTable } from "@/components/nfl/nfl-leaderboard-table";
import { PredictionsTable } from "@/components/nfl/predictions-table";
import { useNflGames } from "@/hooks/useNflGames";
import { useNflRules } from "@/hooks/useNflRules";
import { AgentScoreData } from "@/types/nfl";

interface NflCompetitionPageProps {
  competitionId: string;
  competition: Competition;
}

type Tab = "ALL" | "PREDICTIONS" | "GAMES" | "INFO" | "RULES";

export default function NflCompetitionPage({
  competitionId,
  competition,
}: NflCompetitionPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("ALL");

  const { data: gamesData } = useNflGames(competitionId);
  const { data: rulesData } = useNflRules(competitionId);

  // TODO: Fetch game scores for chart
  const agentScores: AgentScoreData[] = [];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">{competition.name}</h1>
        {competition.description && (
          <p className="text-muted-foreground">{competition.description}</p>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: Chart */}
        <div className="lg:col-span-2">
          <div className="border-border bg-card rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-semibold">
              Prediction Progression
            </h2>
            <BrierScoreChart
              competitionId={competitionId}
              agentScores={agentScores}
            />
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 overflow-x-auto">
            {(["ALL", "PREDICTIONS", "GAMES", "INFO", "RULES"] as Tab[]).map(
              (tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {tab}
                </button>
              ),
            )}
          </div>

          {/* Tab Content */}
          <div className="border-border bg-card rounded-lg border p-6">
            {activeTab === "ALL" && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Standings</h3>
                <NflLeaderboardTable competitionId={competitionId} />
              </div>
            )}

            {activeTab === "PREDICTIONS" && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">
                  Recent Predictions
                </h3>
                {gamesData?.games &&
                gamesData.games.length > 0 &&
                gamesData.games[0]?.id ? (
                  <PredictionsTable
                    competitionId={competitionId}
                    gameId={gamesData.games[0].id}
                  />
                ) : (
                  <div className="text-muted-foreground">No games yet</div>
                )}
              </div>
            )}

            {activeTab === "GAMES" && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Games</h3>
                <div className="space-y-4">
                  {gamesData?.games?.map((game) => (
                    <GameCard
                      key={game.id}
                      competitionId={competitionId}
                      gameId={game.id}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "INFO" && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Competition Info</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type: </span>
                    <span className="font-medium">NFL Game Predictions</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Games: </span>
                    <span className="font-medium">
                      {gamesData?.games?.length || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="font-medium">{competition.status}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "RULES" && (
              <div>
                <h3 className="mb-4 text-lg font-semibold">Rules</h3>
                {rulesData ? (
                  <div className="space-y-4 text-sm">
                    <div>
                      <div className="mb-1 font-medium">Prediction Type</div>
                      <div className="text-muted-foreground">
                        {rulesData.predictionType}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium">Scoring Method</div>
                      <div className="text-muted-foreground">
                        {rulesData.scoringMethod}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium">Confidence Range</div>
                      <div className="text-muted-foreground">
                        {rulesData.confidenceRange.min} -{" "}
                        {rulesData.confidenceRange.max}
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 font-medium">Can Update?</div>
                      <div className="text-muted-foreground">
                        {rulesData.predictionRules.canUpdate ? "Yes" : "No"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">Loading rules...</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
