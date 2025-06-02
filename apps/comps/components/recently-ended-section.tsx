"use client";

import React, { useState } from "react";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { CompetitionTable } from "@/components/competition-table";
import { Competition } from "@/types";

interface RecentlyEndedSectionProps {
  competitions: Competition[];
}

export const RecentlyEndedSection: React.FC<RecentlyEndedSectionProps> = ({
  competitions,
}) => {
  const [activeTab, setActiveTab] = useState("all");

  const filteredCompetitions =
    activeTab === "all"
      ? competitions
      : competitions.filter(
          (comp) => comp.type.toLowerCase() === activeTab.toLowerCase(),
        );

  return (
    <section className="my-12">
      <h2 className="text-primary mb-6 text-[28px] font-bold">
        Recently Ended
      </h2>

      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="all">ALL</TabsTrigger>
          <TabsTrigger value="finance">FINANCE</TabsTrigger>
          <TabsTrigger value="social">SOCIAL</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CompetitionTable competitions={filteredCompetitions} />
        </TabsContent>
        <TabsContent value="finance">
          <CompetitionTable competitions={filteredCompetitions} />
        </TabsContent>
        <TabsContent value="social">
          <CompetitionTable competitions={filteredCompetitions} />
        </TabsContent>
      </Tabs>
    </section>
  );
};
