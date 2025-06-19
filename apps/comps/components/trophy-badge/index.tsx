import React from "react";
import Image from "next/image";
import Link from "next/link";
import {Trophy, AwardIcon, ArrowUpRight} from "lucide-react";

import {cn} from "@recallnet/ui2/lib/utils";
import {Tooltip} from "@recallnet/ui2/components/tooltip";
import {useCompetition} from "@/hooks/useCompetition";
import {Hexagon} from "@/components/hexagon";

interface TrophyBadgeProps {
  trophy: {
    competitionId: string;
    rank: number;
    imageUrl: string;
  };
}

const rankColors: Record<number, string> = {
  1: "bg-yellow-500",
  2: "bg-gray-400",
  3: "bg-amber-800",
};

const shineStyles = `
  @keyframes shine {
    0% {
      transform: translateX(-100%) rotate(25deg);
      opacity: 0;
    }
    50% {
      opacity: 1;
    }
    100% {
      transform: translateX(200%) rotate(25deg);
      opacity: 0;
    }
  }
`;

export const TrophyBadge: React.FC<TrophyBadgeProps> = ({trophy}) => {
  const {competitionId, rank, imageUrl} = trophy;
  const {data} = useCompetition(competitionId);

  const isTop3 = rank >= 1 && rank <= 3;
  const colorClass = rankColors[rank] || "bg-gray-700";

  const Icon =
    rank === 1 ? Trophy : rank <= 3 ? AwardIcon : () => <div className="w-4" />;

  return (
    <Tooltip
      content={
        <div className="flex items-center gap-2">
          <Icon size={16} />
          <span className="whitespace-nowrap text-sm text-white">
            {rank === 1
              ? `1st Place at ${name}`
              : rank === 2
                ? `2nd Place at ${name}`
                : rank === 3
                  ? `3rd Place at ${name}`
                  : `Participant at ${name}`}
          </span>
          <Link href={`/competitions/${competitionId}`} target="_blank">
            <ArrowUpRight size={14} />
          </Link>
        </div>
      }
    >
      <div className="relative">
        {/* Shine animation style tag */}
        <style>{shineStyles}</style>

        {/* Outer border hexagon */}
        <Hexagon
          className={cn(
            "absolute left-0 top-0 -z-10 h-14 w-14",
            colorClass
          )}
        />

        {/* Inner image hexagon */}
        <Hexagon className="relative h-13 w-13 overflow-hidden border border-gray-800 shadow-md">
          <Image
            src={imageUrl}
            alt="competition"
            fill
            className="object-cover h-10 w-full top-0 left-0"
          />

          {isTop3 && (
            <>
              <div className="absolute inset-0 bg-white/10 pointer-events-none" />

              <div
                className="pointer-events-none absolute -inset-y-2 -left-full w-1/2 bg-white/20 blur-sm"
                style={{
                  animation: "shine 2s ease-in-out infinite",
                }}
              />
            </>
          )}
        </Hexagon>
      </div>
    </Tooltip>
  );
};

