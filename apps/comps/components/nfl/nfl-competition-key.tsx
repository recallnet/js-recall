"use client";

import { useState } from "react";

import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { BoostsTabContent } from "@/components/competition-key-boost";
import { CompetitionInfoSections } from "@/components/competition-key-info";
import { GameTabs } from "@/components/nfl/game-tabs";
import { GamesAccordion } from "@/components/nfl/games-accordion";
import { PredictionsTable } from "@/components/nfl/predictions-table";
import type { RouterOutputs } from "@/rpc/router";
import type { NflGame } from "@/types/nfl";

type CompetitionDetails = RouterOutputs["competitions"]["getById"];
type RulesResponse = RouterOutputs["nfl"]["getRules"];
const tabs = ["games", "predictions", "boosts", "info", "rules"] as const;
type TabKey = (typeof tabs)[number];

interface NflCompetitionKeyProps {
  competitionId: string;
  competition: CompetitionDetails;
  games: NflGame[];
  selectedGameId?: string;
  onSelectGame?: (gameId: string, goToPredictions?: boolean) => void;
  rules?: RulesResponse;
  rulesLoading?: boolean;
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
  activeTab,
  onTabChange,
}: NflCompetitionKeyProps) {
  const [internalTab, setInternalTab] = useState<TabKey>("games");
  const currentTab = activeTab ?? internalTab;

  const handleTabChange = (value: string) => {
    if (!tabs.includes(value as TabKey)) {
      return;
    }
    setInternalTab(value as TabKey);
    onTabChange?.(value as TabKey);
  };

  const selectedGame = games.find((game) => game.id === selectedGameId);

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
          <TabsTrigger value="games" className={tabClass}>
            Games
          </TabsTrigger>
          <TabsTrigger value="predictions" className={tabClass}>
            Predictions
          </TabsTrigger>
          <TabsTrigger value="boosts" className={tabClass}>
            Boosts
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

      <TabsContent value="boosts" className="m-0 flex-1 overflow-hidden border">
        <BoostsTabContent competition={competition} />
      </TabsContent>

      <TabsContent
        value="info"
        className="m-0 flex-1 overflow-hidden rounded-lg border border-white/10"
      >
        <CompetitionInfoSections competition={competition} />
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
