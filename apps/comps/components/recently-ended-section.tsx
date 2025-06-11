"use client";

import React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { CompetitionCard } from "@/components/competition-card";
import { Competition } from "@/types";

interface RecentlyEndedSectionProps {
  competitions: Competition[];
}

export const RecentlyEndedSection: React.FC<RecentlyEndedSectionProps> = ({
  competitions,
}) => {
  return (
    <section className="my-12">
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="border-b-1 mb-6 flex w-full pb-6">
          <div className="flex w-full items-center justify-between">
            <div className="ml-2 flex items-center gap-2">
              <span className="text-2xl font-bold">Completed Competitions</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 md:grid md:grid-cols-2">
          {competitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};
