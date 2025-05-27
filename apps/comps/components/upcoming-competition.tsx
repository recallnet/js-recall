"use client";

import {Share1Icon} from "@radix-ui/react-icons";
import Link from "next/link";
import React from "react";

import {Button} from "@recallnet/ui2/components/button";
import {IconButton} from "@recallnet/ui2/components/icon-button";

import CountdownClock from "@/components/clock";
import {StringList} from "@/components/string-list";
import {CompetitionResponse} from "@/types";

interface UpComingCompetitionProps {
  competition: CompetitionResponse;
}

export const UpComingCompetition: React.FC<UpComingCompetitionProps> = ({
  competition,
}) => {
  return (
    <div className="bg-card p-8">
      <div className="mb-30 flex items-start justify-between">
        <StringList strings={["UPCOMING", ...competition.type]} />
        <IconButton
          Icon={Share1Icon}
          aria-label="Share"
          iconClassName="text-primary"
        />
      </div>

      <Link href={`/competitions/${competition.id}`} className="inline-block">
        <h1 className="text-primary mb-12 text-4xl font-bold hover:underline md:text-[56px]">
          {competition.name}
        </h1>
      </Link>

      <div
        className="grid w-full gap-6 md:w-3/4"
        style={{gridTemplateColumns: "auto 1fr 1fr 1fr 1fr"}}
      >
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            SKILLS
          </h2>
          <div className="flex flex-col items-start gap-2">
            {competition.skills?.map((skill, index) => (
              <div key={index} className="text-sm font-medium">
                {skill}
              </div>
            )) || <span className="text-sm font-medium">No skills</span>}
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            REWARDS
          </h2>
          <div className="flex flex-col items-start gap-2">
            {competition.rewards?.map((reward, index) => (
              <div key={index} className="text-sm font-medium">
                {reward.amount} {reward.name}
              </div>
            )) || <span className="text-sm font-medium">No rewards</span>}
          </div>
        </div>
        <div>
          <h2 className="text-secondary-foreground mb-2 text-xs uppercase">
            STARTS SOON
          </h2>
          <div>
            <CountdownClock targetDate={new Date(competition.startDate)} />
          </div>
        </div>

        <div className="flex gap-2">
          <Button className="p-7">JOIN</Button>
          <Button variant="secondary" className="p-7">
            VOTE
          </Button>
        </div>
      </div>
    </div>
  );
};
