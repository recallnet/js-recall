"use client";

import Image from "next/image";
import React from "react";

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
  const hasImage = Boolean(competition.imageUrl);

  return (
    <Card
      cropSize={45}
      corner="bottom-left"
      className={cn("bg-card relative flex flex-col px-6 py-5", className)}
    >
      {hasImage ? (
        <>
          <Image
            src={competition.imageUrl as string}
            alt={competition.name}
            fill
            className="absolute z-0 mt-1 object-cover"
          />
          <div className="absolute inset-0 z-10 h-full w-full bg-[linear-gradient(rgba(0,0,0)_10%,transparent_60%,transparent_100%)] bg-gradient-to-b" />
        </>
      ) : (
        <div className="absolute z-0 flex h-full w-full items-end justify-end pb-14 pr-14">
          <Image
            src={"/competition_image_container.svg"}
            alt={competition.name}
            width={550}
            height={550}
          />
        </div>
      )}

      <div className="z-10 flex items-start justify-between pl-2 pr-5">
        <h1 className="mb-6 mt-4 text-4xl font-bold">{competition.name}</h1>
        <div className="flex h-3/4 items-center">
          <ShareModal
            url={`${process.env.NEXT_PUBLIC_FRONTEND_URL}/competitions/${competition.id}`}
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
      </div>
    </Card>
  );
};
