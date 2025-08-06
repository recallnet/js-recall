"use client";

import Image from "next/image";
import React from "react";

import { Badge } from "@recallnet/ui2/components/badge";
import { Card } from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import { Competition } from "@/types";

import { ShareModal } from "./share-modal/index";

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
      <div className="flex h-1/2 flex-col pl-2 pr-5 pt-5">
        <div className="mb-2 flex items-start justify-between">
          <div className="flex gap-2">
            <Badge>{competition.type}</Badge>
          </div>
          <ShareModal
            url={`https://app.recall.network/competitions/${competition.id}`}
            title="Share Competition"
            subtitle={
              <p className="text-muted-foreground text-sm">
                Share this competition via
              </p>
            }
            size={20}
            className="text-gray-500"
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
