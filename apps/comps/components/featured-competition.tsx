"use client";

import Link from "next/link";
import React from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";

import { useUserSession } from "@/hooks/useAuth";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { CompetitionStatus, UserCompetition } from "@/types";

import {
  formatCompetitionDates,
  formatCompetitionType,
} from "../utils/competition-utils";
import { CompetitionActions } from "./competition-actions";
import { CompetitionStatusBanner } from "./competition-status-banner";
import { TopLeadersList } from "./featured-competition/top-leaders-list";
import { ParticipantsAvatars } from "./participants-avatars";
import { Rewards } from "./rewards";

interface FeaturedCompetitionProps {
  competition: UserCompetition;
}

export const FeaturedCompetition: React.FC<FeaturedCompetitionProps> = ({
  competition,
}) => {
  const session = useUserSession();
  const { data: topLeaders, isLoading } = useCompetitionAgents(competition.id, {
    sort: "rank",
  });

  const duration = formatCompetitionDates(
    competition.startDate,
    competition.endDate,
  );

  return (
    <Card
      className="bg-card group w-full opacity-95 transition duration-500 ease-in-out hover:opacity-100"
      cropSize={0}
    >
      <CompetitionStatusBanner status={competition.status} />

      <div className="flex flex-col gap-2 border-b px-6 py-3">
        <Link
          href={`/competitions/${competition.id}`}
          className="group inline-block"
        >
          <h1 className="my-4 text-3xl font-bold group-hover:underline">
            {competition.name}
          </h1>
        </Link>

        <Badge variant="gray" className="mb-4 px-3 py-1 text-sm">
          {formatCompetitionType(competition.type)}
        </Badge>

        <p className="text-secondary-foreground mb-4 max-w-3xl">
          {competition.description}
        </p>
      </div>

      <div className="flex border-b">
        <div className="w-full border-r px-6 py-4">
          <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
            Duration
          </h3>
          <p className="font-semibold">{duration}</p>
        </div>
        <div className="w-full px-6 py-4">
          <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
            Reward
          </h3>
          {competition.rewards ? (
            <Rewards rewards={competition.rewards} />
          ) : (
            <p className="font-semibold">TBA</p>
          )}
        </div>
      </div>

      <div className="flex gap-8 border-b">
        <div className="w-full px-6 py-4">
          <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
            {competition.status === CompetitionStatus.Active
              ? "Participants"
              : "Pre-Registered"}
          </h3>
          {topLeaders?.agents.length ? (
            <ParticipantsAvatars
              agents={topLeaders?.agents}
              compId={competition.id}
              showRank={competition.status === CompetitionStatus.Active}
            />
          ) : (
            <span className="text-sm">-</span>
          )}
        </div>
        <div className="w-full justify-items-end p-6">
          {session.isInitialized && session.isAuthenticated && (
            <>
              <h3 className="text-secondary-foreground mb-1 text-sm font-semibold uppercase">
                Your Agents
              </h3>
              {competition.agents.length > 0 ? (
                <ParticipantsAvatars
                  compId={competition.id}
                  agents={competition.agents}
                />
              ) : (
                <div className="flex justify-center">
                  <span className="text-sm">-</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {competition.status === CompetitionStatus.Active && (
        <div className="xs:block hidden">
          <TopLeadersList
            agents={topLeaders?.agents || []}
            isLoading={isLoading}
          />
        </div>
      )}

      <CompetitionActions
        competition={competition}
        className="flex items-end justify-center gap-4 p-6"
      />
    </Card>
  );
};
