"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { tanstackClient } from "@/rpc/clients/tanstack-query";
import { CompetitionWithUserAgents } from "@/types";
import { formatAmount } from "@/utils/format";

import {
  formatCompetitionDates,
  formatCompetitionType,
} from "../utils/competition-utils";
import { Recall } from "./Recall";
import { CompetitionActions } from "./competition-actions";
import { CompetitionStateSummary } from "./competition-state-summary";
import { CompetitionStatusBanner } from "./competition-status-banner";
import { ParticipantsAvatars } from "./participants-avatars";
import { Rewards } from "./rewards";
import { RewardsTGE } from "./rewards-tge";

interface CompetitionCardProps {
  competition: CompetitionWithUserAgents;
  className?: string;
}

export const CompetitionCard: React.FC<CompetitionCardProps> = ({
  competition,
  className,
}) => {
  const { data: topLeaders } = useQuery(
    tanstackClient.competitions.getAgents.queryOptions({
      input: { competitionId: competition.id },
    }),
  );

  const duration = formatCompetitionDates(
    competition.startDate,
    competition.endDate,
  );

  return (
    <Card
      cropSize={35}
      corner="bottom-right"
      className={cn("bg-card group flex w-full flex-col", className)}
    >
      <CompetitionStatusBanner status={competition.status} />

      <div className="flex h-full w-full">
        <div className="flex w-full flex-col gap-2 border-r">
          <div className="flex w-full items-start justify-between align-top">
            <Link
              href={`/competitions/${competition.id}`}
              className="group inline-block p-6"
            >
              <h1 className="text-primary-foreground text-3xl font-bold group-hover:underline">
                {competition.name}
              </h1>
            </Link>

            <ParticipantsAvatars
              compId={competition.id}
              agents={competition.agents}
              className="pr-6 pt-6"
              showRank={competition.status !== "pending"}
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
            showRank={competition.status !== "pending"}
          />

          <hr />

          {competition.status === "ended" ? null : (
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
              <p className="text-primary-foreground font-semibold">
                {duration}
              </p>
            </div>
            <div className="w-full p-6">
              {/* Rewards (token or legacy) */}
              <h3 className="text-secondary-foreground mb-1 text-xs font-semibold uppercase">
                Rewards
              </h3>
              {competition.rewardsTge ? (
                <RewardsTGE
                  rewards={{
                    agentPrizePool: BigInt(competition.rewardsTge.agentPool),
                    userPrizePool: BigInt(competition.rewardsTge.userPool),
                  }}
                  compact
                />
              ) : competition.rewards ? (
                <Rewards rewards={competition.rewards} compact />
              ) : (
                <p className="text-primary-foreground font-semibold">TBA</p>
              )}
              {/* Minimum stake to join, if present */}

              <h3 className="text-secondary-foreground mb-1 mt-4 text-xs font-semibold uppercase">
                Minimum Stake
              </h3>
              <div className="text-primary-foreground flex items-center gap-1 font-bold">
                {competition.minimumStake ? (
                  <>
                    <Recall /> {formatAmount(competition.minimumStake, 0, true)}
                  </>
                ) : (
                  <span className="text-primary-foreground font-semibold">
                    N/A
                  </span>
                )}
              </div>
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
