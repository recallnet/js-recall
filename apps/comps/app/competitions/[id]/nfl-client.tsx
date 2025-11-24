"use client";

import { ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import CompetitionSkeleton from "@/components/competition-skeleton";
import { JoinCompetitionButton } from "@/components/join-competition-button";
import { BrierScoreChart } from "@/components/nfl/brier-score-chart";
import { GameTabs } from "@/components/nfl/game-tabs";
import {
  NflCompetitionKey,
  NflCompetitionKeyTab,
} from "@/components/nfl/nfl-competition-key";
import { useNflGames } from "@/hooks/useNflGames";
import { useNflRules } from "@/hooks/useNflRules";
import { openForBoosting } from "@/lib/open-for-boosting";
import type { RouterOutputs } from "@/rpc/router";
import { NflGame } from "@/types/nfl";

type CompetitionDetails = RouterOutputs["competitions"]["getById"];

interface NflCompetitionPageProps {
  competitionId: string;
  competition: CompetitionDetails;
}

export default function NflCompetitionPage({
  competitionId,
  competition,
}: NflCompetitionPageProps) {
  const [selectedGameId, setSelectedGameId] = useState<string | undefined>();
  const [activeKeyTab, setActiveKeyTab] =
    useState<NflCompetitionKeyTab>("leaderboard");

  const {
    data: gamesData,
    isLoading: gamesLoading,
    error: gamesError,
  } = useNflGames(competitionId);
  const { data: rulesData, isLoading: rulesLoading } =
    useNflRules(competitionId);

  const games = useMemo(() => gamesData?.games ?? [], [gamesData]);

  useEffect(() => {
    if (!games.length) {
      return;
    }

    const alreadySelected = games.some((game) => game.id === selectedGameId);
    if (!alreadySelected) {
      setSelectedGameId(games[0]?.id);
    }
  }, [games, selectedGameId]);

  const selectedGame: NflGame | undefined = useMemo(
    () => games.find((game) => game.id === selectedGameId),
    [games, selectedGameId],
  );

  const completedGames = games.filter((game) => game.status === "final").length;

  const handleSelectGame = (
    gameId: string,
    goToPredictions?: boolean,
  ): void => {
    setSelectedGameId(gameId);
    if (goToPredictions) {
      setActiveKeyTab("predictions");
    }
  };

  if (gamesLoading && !gamesData) {
    return <CompetitionSkeleton />;
  }

  const BoostAgentsBtn = ({
    className,
    disabled,
  }: {
    className: string;
    disabled?: boolean;
  }) => (
    <Button
      disabled={!openForBoosting(competition) || disabled}
      variant="default"
      className={cn(
        "border border-yellow-500 bg-black text-white hover:bg-yellow-500 hover:text-black disabled:hover:bg-black disabled:hover:text-white",
        className,
      )}
      size="lg"
    >
      <span className="font-semibold">BOOST AGENTS</span>{" "}
      <ChevronRight className="ml-2" size={18} />
    </Button>
  );

  const chartCard = (
    <div className="w-full">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Prediction Progression</h2>
        </div>
      </div>

      {gamesLoading && (
        <div className="h-150">
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
  );

  return (
    <div>
      <BreadcrumbNav
        items={[
          { label: "Home", href: "/" },
          { label: "Competitions", href: "/competitions" },
          { label: competition.name },
        ]}
      />

      <div className="container mx-auto">
        <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-4 md:col-span-2">{chartCard}</div>

          <div className="space-y-4 md:col-span-1">
            <NflCompetitionKey
              competitionId={competitionId}
              competition={competition}
              games={games}
              selectedGameId={selectedGameId}
              onSelectGame={handleSelectGame}
              rules={rulesData}
              rulesLoading={rulesLoading}
              completedGames={completedGames}
              activeTab={activeKeyTab}
              onTabChange={setActiveKeyTab}
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <JoinCompetitionButton
                competitionId={competitionId}
                className="w-full border border-white bg-white text-blue-500 hover:border-blue-500 hover:bg-blue-500 hover:text-white disabled:hover:border-white disabled:hover:bg-white disabled:hover:text-blue-500"
                disabled={competition.status !== "pending"}
                size="lg"
              >
                <span>COMPETE</span> <Plus className="ml-2" size={18} />
              </JoinCompetitionButton>

              <BoostAgentsBtn className="w-full uppercase" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
