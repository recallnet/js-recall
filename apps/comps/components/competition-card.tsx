"use client";

import Image from "next/image";
import Link from "next/link";
import React, { useMemo } from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { CompetitionStatus, CompetitionWithUserAgents } from "@/types";

import {
  formatCompetitionDates,
  formatCompetitionType,
} from "../utils/competition-utils";
import { CompetitionActions } from "./competition-actions";
import { CompetitionStateSummary } from "./competition-state-summary";
import { CompetitionStatusBanner } from "./competition-status-banner";
import { ParticipantsAvatars } from "./participants-avatars";
import { Rewards } from "./rewards";

interface CompetitionCardProps {
  competition: CompetitionWithUserAgents;
  className?: string;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  className,
}) => {
  const { data: topLeaders } = useCompetitionAgents(competition.id);

  const duration = formatCompetitionDates(
    competition.startDate,
    competition.endDate,
  );

  const status = useMemo(() => {
    switch (competition.status) {
      case "active":
        return CompetitionStatus.Active;
      case "pending":
        return CompetitionStatus.Pending;
      case "ended":
      case "ending":
        return CompetitionStatus.Ended;
    }
  }, [competition.status]);

  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className={cn("bg-card group flex w-full flex-col", className)}
    >
      <CompetitionStatusBanner status={status} />

      <div className="flex h-full w-full">
        <div className="flex w-full flex-col gap-2 border-r">
          <div className="flex w-full items-start justify-between align-top">
            <Link
              href={`/competitions/${competition.id}`}
              className="group inline-block p-6"
            >
              <h1 className="text-3xl font-bold group-hover:underline">
                {competition.name}
              </h1>
            </Link>

            <ParticipantsAvatars
              compId={competition.id}
              agents={competition.agents}
              className="pr-6 pt-6"
              showRank={competition.status !== CompetitionStatus.Pending}
            />
          </div>

          <Badge variant="gray" className="ml-6 px-3 py-1 text-sm">
            {formatCompetitionType(competition.type)}
          </Badge>

          <p className="text-secondary-foreground max-h-50 mb-auto overflow-y-auto text-ellipsis px-6 py-2">
            {competition.description}
          </p>

          <ParticipantsAvatars
            compId={competition.id}
            agents={topLeaders?.agents || []}
            className="px-6 py-2"
            showRank={competition.status !== CompetitionStatus.Pending}
          />

          <hr />

          {competition.status === CompetitionStatus.Ended ? null : (
            <CompetitionStateSummary
              competition={competition}
              className="px-6 py-2"
            />
          )}

          <CompetitionActions competition={competition} className="px-6 pb-4" />
        </div>

        <div className="flex w-full flex-col">
          <div className="flex w-full">
            <div className="w-full border-r p-6">
              <h3 className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
                Duration
              </h3>
              <p className="font-semibold">{duration}</p>
            </div>
            <div className="w-full p-6">
              <h3 className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
                Reward
              </h3>
              {competition.rewards ? (
                <Rewards rewards={competition.rewards} compact />
              ) : (
                <p className="font-semibold">TBA</p>
              )}
            </div>
          </div>
          <div className="relative h-full w-full content-center overflow-hidden">
            {competition.imageUrl ? (
              <Image
                src={competition.imageUrl}
                alt="Competition"
                fill={true}
                className="duration-800 object-cover transition ease-in-out group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            ) : (
              <Image
                src={"/competition_image_container.svg"}
                alt={competition.name}
                width={550}
                height={550}
                className="duration-800 object-cover transition ease-in-out group-hover:scale-105"
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
