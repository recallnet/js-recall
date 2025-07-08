"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";

import {Badge} from "@recallnet/ui2/components/badge";
import {Card} from "@recallnet/ui2/components/card";
import {cn} from "@recallnet/ui2/lib/utils";

import {useCompetitionAgents} from "@/hooks/useCompetitionAgents";
import {CompetitionStatus, UserCompetition} from "@/types";

import {formatCompetitionDates} from "../utils/competition-utils";
import {CompetitionActions} from "./competition-actions";
import {CompetitionStatusBanner} from "./competition-status-banner";
import {ParticipantsAvatars} from "./participants-avatars";

interface CompetitionCardProps {
  competition: UserCompetition;
  className?: string;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  className,
}) => {
  const {data: topLeaders} = useCompetitionAgents(competition.id, {
    limit: 5,
  });

  const duration = formatCompetitionDates(
    competition.startDate,
    competition.endDate,
  );

  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className={cn("bg-card flex w-full flex-col group", className)}
    >
      <CompetitionStatusBanner status={competition.status} />

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
              agents={competition.agents}
              className="pr-6 pt-6"
              showRank={competition.status !== CompetitionStatus.Pending}
            />
          </div>

          <Badge variant="gray" className="ml-6 px-3 py-1 text-sm">
            {competition.type}
          </Badge>

          <p className="text-secondary-foreground max-h-50 mb-auto overflow-y-auto text-ellipsis px-6 py-2">
            {competition.description}
          </p>

          <ParticipantsAvatars
            agents={topLeaders?.agents || []}
            className="px-6 py-2"
            showRank={competition.status !== CompetitionStatus.Pending}
          />

          <hr />

          <CompetitionActions competition={competition} className="px-6 py-4" />
        </div>

        <div className="flex w-full flex-col">
          <div className="flex w-full">
            <div className="w-full border-r p-6">
              <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
                Duration
              </h3>
              <p className="text-xl font-semibold">{duration}</p>
            </div>
            <div className="w-full p-6">
              <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
                Reward
              </h3>
              <p className="text-xl font-semibold">TBA</p>
            </div>
          </div>
          <div className="relative h-full w-full overflow-hidden">
            {competition.imageUrl && (
              <Image
                src={"https://png.pngtree.com/thumb_back/fh260/background/20240715/pngtree-crypto-trade-btc-bitcoin-illustration-for-graphics-marketing-promotion-image_16011614.jpg"}
                alt="Competition"
                fill={true}
                className="object-cover group-hover:scale-105 transition ease-in-out duration-800"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = "none";
                }}
              />
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
