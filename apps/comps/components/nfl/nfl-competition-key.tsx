"use client";

import { format } from "date-fns";
import { useMemo, useState } from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { GameTabs } from "@/components/nfl/game-tabs";
import { GamesAccordion } from "@/components/nfl/games-accordion";
import { NflLeaderboardTable } from "@/components/nfl/nfl-leaderboard-table";
import { PredictionsTable } from "@/components/nfl/predictions-table";
import type { RouterOutputs } from "@/rpc/router";
import type { NflGame } from "@/types/nfl";

type CompetitionDetails = RouterOutputs["competitions"]["getById"];
type RulesResponse = RouterOutputs["nfl"]["getRules"];
const tabs = ["leaderboard", "predictions", "games", "info", "rules"] as const;
type TabKey = (typeof tabs)[number];

interface NflCompetitionKeyProps {
  competitionId: string;
  competition: CompetitionDetails;
  games: NflGame[];
  selectedGameId?: string;
  onSelectGame?: (gameId: string, goToPredictions?: boolean) => void;
  rules?: RulesResponse;
  rulesLoading?: boolean;
  completedGames: number;
  activeTab?: TabKey;
  onTabChange?: (tab: TabKey) => void;
}

const tabClass =
  "border border-white bg-black px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition-colors duration-200 hover:bg-white hover:text-black data-[state=active]:bg-white data-[state=active]:text-black";
const formatRuleText = (value: string) => value.replace(/_/g, " ");

export function NflCompetitionKey({
  competitionId,
  competition,
  games,
  selectedGameId,
  onSelectGame,
  rules,
  rulesLoading,
  completedGames,
  activeTab,
  onTabChange,
}: NflCompetitionKeyProps) {
  const [internalTab, setInternalTab] = useState<TabKey>("leaderboard");
  const currentTab = activeTab ?? internalTab;

  const handleTabChange = (value: string) => {
    if (!tabs.includes(value as TabKey)) {
      return;
    }
    setInternalTab(value as TabKey);
    onTabChange?.(value as TabKey);
  };

  const totalGames = games.length;
  const selectedGame = games.find((game) => game.id === selectedGameId);

  const infoItems = useMemo(
    () => [
      { label: "Status", value: competition.status },
      { label: "Type", value: competition.type },
      {
        label: "Start",
        value: competition.startDate
          ? format(new Date(competition.startDate), "MMM d, yyyy h:mm a")
          : "TBD",
      },
      {
        label: "End",
        value: competition.endDate
          ? format(new Date(competition.endDate), "MMM d, yyyy h:mm a")
          : "TBD",
      },
    ],
    [competition],
  );

  const renderInfo = () => (
    <div className="text-secondary-foreground space-y-4 text-sm">
      {competition.description && (
        <p className="text-primary-foreground leading-relaxed">
          {competition.description}
        </p>
      )}
      <div className="space-y-3">
        {infoItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between text-xs uppercase tracking-wide"
          >
            <span className="text-secondary-foreground">{item.label}</span>
            <span className="text-primary-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const renderRules = () => {
    if (rulesLoading) {
      return <Skeleton className="h-20 w-full" />;
    }
    if (!rules) {
      return (
        <p className="text-secondary-foreground text-sm">
          Rules unavailable. Please check back later.
        </p>
      );
    }

    return (
      <div className="text-secondary-foreground space-y-4 text-sm">
        <div>
          <p className="text-primary-foreground font-semibold">
            {formatRuleText(rules.predictionType)}
          </p>
          <p>{formatRuleText(rules.scoringMethod)}</p>
        </div>
        <div>
          <p className="text-primary-foreground font-semibold">Scoring</p>
          <p className="text-xs leading-relaxed">
            {rules.scoringFormula.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-secondary-foreground/80 uppercase">
              Min Confidence
            </p>
            <p className="text-primary-foreground">
              {rules.confidenceRange.min}
            </p>
          </div>
          <div>
            <p className="text-secondary-foreground/80 uppercase">
              Max Confidence
            </p>
            <p className="text-primary-foreground">
              {rules.confidenceRange.max}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="flex h-full max-h-[550px] flex-col text-white"
    >
      <div className="mb-6 overflow-x-auto">
        <TabsList className="flex w-max gap-2">
          <TabsTrigger value="leaderboard" className={tabClass}>
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="predictions" className={tabClass}>
            Predictions
          </TabsTrigger>
          <TabsTrigger value="games" className={tabClass}>
            Games
          </TabsTrigger>
          <TabsTrigger value="info" className={tabClass}>
            Info
          </TabsTrigger>
          <TabsTrigger value="rules" className={tabClass}>
            Rules
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="leaderboard"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <div className="h-full overflow-y-auto p-4">
          <div className="text-secondary-foreground text-xs uppercase">
            Games scored: {completedGames}/{totalGames}
            {completedGames < totalGames &&
              totalGames > 0 &&
              " • Standings update as games finalize"}
          </div>
          <div className="mt-3">
            <NflLeaderboardTable competitionId={competitionId} />
          </div>
        </div>
      </TabsContent>

      <TabsContent
        value="predictions"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <div className="h-full overflow-y-auto p-4">
          {games.length === 0 ? (
            <p className="text-secondary-foreground text-sm">
              No games available for predictions yet.
            </p>
          ) : (
            <div className="space-y-4">
              <GameTabs
                games={games}
                selectedGameId={selectedGameId}
                onSelect={(gameId) => onSelectGame?.(gameId, false)}
                variant="compact"
              />
              {selectedGame ? (
                <PredictionsTable
                  competitionId={competitionId}
                  gameId={selectedGame.id}
                />
              ) : (
                <p className="text-secondary-foreground text-sm">
                  Select a game to view prediction history.
                </p>
              )}
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent
        value="games"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <div className="h-full overflow-y-auto p-4">
          {games.length === 0 ? (
            <p className="text-secondary-foreground text-sm">
              This competition does not have any games configured yet.
            </p>
          ) : (
            <GamesAccordion
              games={games}
              selectedGameId={selectedGameId}
              onSelectGame={(gameId, goToPredictions) =>
                onSelectGame?.(gameId, goToPredictions)
              }
            />
          )}
        </div>
      </TabsContent>

      <TabsContent
        value="info"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <div className="h-full overflow-y-auto p-4">{renderInfo()}</div>
      </TabsContent>

      <TabsContent
        value="rules"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <div className="h-full overflow-y-auto p-4">{renderRules()}</div>
      </TabsContent>
    </Tabs>
  );
}

export type NflCompetitionKeyTab = TabKey;
