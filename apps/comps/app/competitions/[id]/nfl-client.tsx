"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import CompetitionSkeleton from "@/components/competition-skeleton";
import { BrierScoreChart } from "@/components/nfl/brier-score-chart";
import { GameTabs } from "@/components/nfl/game-tabs";
import { GamesAccordion } from "@/components/nfl/games-accordion";
import { NflLeaderboardTable } from "@/components/nfl/nfl-leaderboard-table";
import { PredictionsTable } from "@/components/nfl/predictions-table";
import { useNflGames } from "@/hooks/useNflGames";
import { useNflRules } from "@/hooks/useNflRules";
import type { RouterOutputs } from "@/rpc/router";
import { NflGame } from "@/types/nfl";

type CompetitionDetails = RouterOutputs["competitions"]["getById"];

interface NflCompetitionPageProps {
  competitionId: string;
  competition: CompetitionDetails;
}

type Tab = "ALL" | "PREDICTIONS" | "GAMES" | "INFO" | "RULES";

export default function NflCompetitionPage({
  competitionId,
  competition,
}: NflCompetitionPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();

  const {
    data: gamesData,
    isLoading: gamesLoading,
    error: gamesError,
  } = useNflGames(competitionId);
  const { data: rulesData } = useNflRules(competitionId);

  const gameList = gamesData?.games;
  const games = gameList ?? [];

  useEffect(() => {
    if (!gameList?.length) {
      return;
    }

    const alreadySelected = gameList.some((game) => game.id === selectedGameId);
    if (!alreadySelected) {
      setSelectedGameId(gameList[0]?.id);
    }
  }, [gameList, selectedGameId]);

  const selectedGame: NflGame | undefined = games.find(
    (game) => game.id === selectedGameId,
  );

  const totalGames = games.length;
  const completedGames = games.filter((game) => game.status === "final").length;

  const handleSelectGame = (
    gameId: string,
    goToPredictions?: boolean,
  ): void => {
    setSelectedGameId(gameId);
    if (goToPredictions) {
      setActiveTab("PREDICTIONS");
    }
  };

  if (gamesLoading) {
    return <CompetitionSkeleton />;
  }

  return (
    <div className="">
      <BreadcrumbNav
        items={[
          { label: "Home", href: "/" },
          { label: "Competitions", href: "/competitions" },
          { label: competition.name },
        ]}
      />
      <div className="container mx-auto">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <div className="border-border bg-card rounded-lg border p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    Prediction Progression
                  </h2>
                  {selectedGame && (
                    <p className="text-muted-foreground text-sm">
                      Tracking {selectedGame.awayTeam} @ {selectedGame.homeTeam}
                    </p>
                  )}
                </div>
              </div>
              {gamesLoading && (
                <div className="h-[360px]">
                  <Skeleton className="h-full w-full rounded-lg" />
                </div>
              )}
              {gamesError && (
                <div className="text-destructive text-sm">
                  Failed to load games for this competition.
                </div>
              )}
              {!gamesLoading && !gamesError && games.length > 0 && (
                <>
                  <GameTabs
                    games={games}
                    selectedGameId={selectedGameId}
                    onSelect={(gameId) => handleSelectGame(gameId)}
                  />
                  <div className="mt-4">
                    <BrierScoreChart
                      competitionId={competitionId}
                      game={selectedGame}
                    />
                  </div>
                </>
              )}
              {!gamesLoading && !gamesError && games.length === 0 && (
                <div className="text-muted-foreground text-sm">
                  This competition does not have any games configured yet.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
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

            <div className="border-border bg-card rounded-lg border p-6">
              {activeTab === "ALL" && (
                <div className="space-y-3">
                  <div className="text-muted-foreground text-xs">
                    Games scored: {completedGames}/{totalGames}
                    {completedGames < totalGames &&
                      totalGames > 0 &&
                      " • standings update as games finalize"}
                  </div>
                  <NflLeaderboardTable competitionId={competitionId} />
                </div>
              )}

              {activeTab === "PREDICTIONS" && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">
                      Recent Predictions
                    </h3>
                    {selectedGame && (
                      <p className="text-muted-foreground text-xs">
                        Showing history for {selectedGame.awayTeam} @{" "}
                        {selectedGame.homeTeam}
                      </p>
                    )}
                  </div>
                  {games.length > 0 ? (
                    <>
                      <GameTabs
                        games={games}
                        selectedGameId={selectedGameId}
                        onSelect={(gameId) => handleSelectGame(gameId)}
                        variant="compact"
                      />
                      {selectedGameId ? (
                        <PredictionsTable
                          competitionId={competitionId}
                          gameId={selectedGameId}
                        />
                      ) : (
                        <div className="text-muted-foreground text-sm">
                          Select a game to view predictions.
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      No games yet.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "GAMES" && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Games</h3>
                  {games.length > 0 ? (
                    <GamesAccordion
                      games={games}
                      selectedGameId={selectedGameId}
                      onSelectGame={handleSelectGame}
                    />
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      No games yet.
                    </div>
                  )}
                </div>
              )}

              {activeTab === "INFO" && (
                <div>
                  <h3 className="mb-4 text-lg font-semibold">
                    Competition Info
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Type: </span>
                      <span className="font-medium">NFL Game Predictions</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Games: </span>
                      <span className="font-medium">{totalGames}</span>
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
                    <div className="h-[360px]">
                      <Skeleton className="h-full w-full rounded-lg" />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
