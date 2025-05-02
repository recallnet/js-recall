"use client";

import React from "react";

import { CompetitionCard } from "@/components/competition-card";
import { Competition } from "@/data/competitions";

interface StartingSoonSectionProps {
  competitions: Competition[];
}

export const StartingSoonSection: React.FC<StartingSoonSectionProps> = ({
  competitions,
}) => {
  return (
    <section className="my-12">
      <h2 className="text-primary mb-6 text-[28px] font-bold">Starting Soon</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {competitions.map((competition) => (
          <CompetitionCard
            key={competition.id}
            competition={competition}
            showActions={true}
          />
        ))}
      </div>
    </section>
  );
};
