"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { IconButton } from "@recallnet/ui2/components/icon-button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";

import { StringList } from "@/components/string-list";
import { useCompetitionAgents } from "@/hooks/useCompetitionAgents";
import { AgentResponse, Competition } from "@/types";

interface OngoingCompetitionProps {
  competition: CompetitionResponse;
}

export const OngoingCompetition: React.FC<OngoingCompetitionProps> = ({
  competition,
}) => {
  // Fetch competition agents and sort by score
  const { data, isLoading } = useCompetitionAgents(competition.id, {
    sort: "-score", // Sort by score in descending order
    limit: 3, // Get top 3 leaders
  });

  // Get top 3 leaders
  const topLeaders: AgentResponse[] = data?.agents || [];

  // Medal emoji mapping
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="bg-card p-8">
      <div className="mb-30 flex items-start justify-between">
        <StringList strings={["ONGOING", ...competition.type]} />
        <IconButton
          Icon={Share1Icon}
          aria-label="Share"
          iconClassName="text-primary"
        />
      </div>

      <Link href={`/competitions/${competition.id}`} className="inline-block">
        <h1 className="mb-12 text-4xl font-bold hover:underline md:text-[56px]">
          {competition.name}
        </h1>
      </Link>

      <div
        className="grid w-full gap-6 md:w-3/4"
        style={{ gridTemplateColumns: "auto 1fr 1fr 1fr" }}
      >
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            CURRENT LEADERS
          </span>
          <ul className="space-y-2">
            {isLoading ? (
              <>
                <li className="flex items-center gap-2 whitespace-nowrap">
                  <span>🥇</span>
                  <Skeleton className="h-4 w-20" />
                </li>
                <li className="flex items-center gap-2 whitespace-nowrap">
                  <span>🥈</span>
                  <Skeleton className="h-4 w-20" />
                </li>
                <li className="flex items-center gap-2 whitespace-nowrap">
                  <span>🥉</span>
                  <Skeleton className="h-4 w-20" />
                </li>
              </>
            ) : (
              topLeaders.map((agent, index) => (
                <li
                  key={agent.id}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <span>{medals[index]}</span>
                  <Link href={`/agents/${agent.id}`}>
                    <span className="text-primary text-xs">{agent.name}</span>
                  </Link>
                </li>
              ))
            )}
            {!isLoading && topLeaders.length === 0 && (
              <li className="text-muted-foreground text-xs">
                No participants yet
              </li>
            )}
          </ul>
        </div>
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            SKILLS
          </span>
          <div className="flex flex-col items-start gap-2">
            {competition.skills.map((skill, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs">{skill}</span>
              </div>
            ))}
            {competition.skills.length === 0 && (
              <span className="text-muted-foreground text-xs">
                No skills specified
              </span>
            )}
          </div>
        </div>
        <div>
          <span className="text-secondary-foreground mb-2 whitespace-nowrap text-xs uppercase">
            REWARDS
          </span>
          <div className="flex flex-col items-start gap-2">
            {competition.rewards.map((reward, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="text-xs">
                  {reward.amount} {reward.name}
                </span>
              </div>
            ))}
            {competition.rewards.length === 0 && (
              <span className="text-muted-foreground text-xs">
                No rewards specified
              </span>
            )}
          </div>
        </div>

        <div className="flex">
          <Button variant="secondary" className="p-7">
            VOTE!
          </Button>
        </div>
      </div>
    </div>
  );
};
