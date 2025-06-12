"use client";

import React from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@recallnet/ui2/components/collapsible";

import { CompetitionCard } from "@/components/competition-card";
import { UserCompetition } from "@/types";

interface CompetitionsCollapsibleProps {
  title: string;
  competitions: UserCompetition[];
  emptyMessage: string;
  defaultOpen?: boolean;
}

export const CompetitionsCollapsible: React.FC<
  CompetitionsCollapsibleProps
> = ({ title, competitions, emptyMessage, defaultOpen = true }) => {
  return (
    <section className="my-12">
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger className="border-b-1 mb-6 flex w-full pb-6">
          <div className="flex w-full items-center justify-between">
            <div className="ml-2 flex items-center gap-2">
              <span className="text-2xl font-bold">{title}</span>
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 md:grid md:grid-cols-2">
          {competitions.map((competition) => (
            <CompetitionCard key={competition.id} competition={competition} />
          ))}
          {competitions.length === 0 && (
            <div className="text-secondary-foreground text-sm">
              {emptyMessage}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
};
