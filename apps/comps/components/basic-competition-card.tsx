"use client";

import { Share1Icon } from "@radix-ui/react-icons";
import Image from "next/image";
import React from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { IconButton } from "@recallnet/ui2/components/icon-button";
import { cn } from "@recallnet/ui2/lib/utils";

import { Competition } from "@/types";

interface BasicCompetitionCardProps {
  competition: Competition;
  className?: string;
}

export const BasicCompetitionCard: React.FC<BasicCompetitionCardProps> = ({
  competition,
  className,
}) => {
  return (
    <Card
      cropSize={35}
      corner="bottom-left"
      className={cn("bg-card flex flex-col p-4", className)}
    >
      <div className="flex h-1/2 flex-col">
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <Badge>{competition.type}</Badge>
          </div>
          <IconButton
            Icon={Share1Icon}
            aria-label="Share"
            iconClassName="text-primary"
          />
        </div>
        <h1 className="mb-6 mt-4 text-4xl font-bold">{competition.name}</h1>
      </div>
      <div className="relative hidden h-1/2 justify-end sm:flex">
        {competition.imageUrl && (
          <Image
            src={competition.imageUrl}
            alt={competition.name}
            fill
            className="object-contain"
          />
        )}
      </div>
    </Card>
  );
};
