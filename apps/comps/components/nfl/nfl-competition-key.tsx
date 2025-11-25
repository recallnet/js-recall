"use client";

import { Info, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

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

// Capitalize the first letter of the text and split by underscores
const formatRuleText = (value: string) =>
  value.replace(/_/g, " ").toLowerCase().charAt(0).toUpperCase() +
  value.replace(/_/g, " ").slice(1);

export function NflCompetitionKey({
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
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const currentTab = activeTab ?? internalTab;
  const competitionId = competition.id;

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
          <p className="text-secondary-foreground text-xs font-semibold uppercase">
            {formatRuleText(rules.predictionType)}
          </p>
          <p className="text-primary-foreground text-sm">
            {formatRuleText(rules.scoringMethod)}
          </p>
        </div>
        <div>
          <p className="text-secondary-foreground text-xs font-semibold uppercase">
            Scoring
          </p>
          <p className="text-primary-foreground text-sm">
            {rules.scoringFormula.description}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-secondary-foreground text-xs font-semibold uppercase">
              Min Confidence
            </p>
            <p className="text-primary-foreground">
              {rules.confidenceRange.min.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-secondary-foreground text-xs font-semibold uppercase">
              Max Confidence
            </p>
            <p className="text-primary-foreground">
              {rules.confidenceRange.max.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const keyContent = (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="flex h-full flex-col text-white"
    >
      <div className="mb-6 shrink-0 overflow-x-auto">
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
        className="border-border m-0 flex-1 overflow-hidden rounded-xl border"
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
        className="border-border m-0 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
          {games.length === 0 ? (
            <p className="text-secondary-foreground text-sm">
              No games available for predictions yet.
            </p>
          ) : (
            <div className="flex min-h-0 flex-col gap-4">
              <div className="shrink-0">
                <GameTabs
                  games={games}
                  selectedGameId={selectedGameId}
                  onSelect={(gameId) => onSelectGame?.(gameId, false)}
                  variant="compact"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
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
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="boosts" className="m-0 flex-1 overflow-hidden border">
        <BoostsTabContent competition={competition} />
      </TabsContent>

      <TabsContent
        value="info"
        className="border-border m-0 flex-1 overflow-hidden rounded-lg border"
      >
        <CompetitionInfoSections competition={competition} />
      </TabsContent>

      <TabsContent
        value="rules"
        className="border-border m-0 flex-1 overflow-hidden rounded-lg border"
      >
        <div className="h-full overflow-y-auto p-4">{renderRules()}</div>
      </TabsContent>
    </Tabs>
  );

  return (
    <>
      {/* Desktop view - fixed height */}
      <div className="hidden h-[550px] md:block">{keyContent}</div>

      {/* Mobile view - button and slide-in drawer */}
      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileDrawerOpen(true)}
          className="fixed bottom-10 right-6 z-40 flex items-center gap-2 border-white bg-black px-4 py-3 font-semibold uppercase text-white shadow-lg hover:bg-white hover:text-black"
        >
          <Info size={20} />
          <span>View Details</span>
        </Button>

        {/* Backdrop overlay */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-300"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Slide-in drawer */}
        <div
          className={cn(
            "fixed right-0 top-0 z-[60] h-full w-[85vw] max-w-md transform border-l border-gray-800 bg-black shadow-xl transition-transform duration-300 ease-in-out",
            mobileDrawerOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between border-b border-gray-800 p-4">
              <h2 className="text-lg font-bold text-white">
                Competition Details
              </h2>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer content */}
            <div className="flex-1 overflow-y-auto">{keyContent}</div>
          </div>
        </div>
      </div>
    </>
  );
}

export type NflCompetitionKeyTab = TabKey;
