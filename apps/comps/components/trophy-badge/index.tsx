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
  1: "bg-yellow-300",
  2: "bg-gray-400",
  3: "bg-amber-600",
};

export const TrophyBadge: React.FC<TrophyBadgeProps> = ({trophy}) => {
  const {competitionId, rank, imageUrl} = trophy;
  const {data} = useCompetition(competitionId);

  const isTop3 = rank >= 1 && rank <= 3;
  const colorClass = rankColors[rank] || "bg-gray-700";

  const Icon =
    rank === 1 ? Trophy : rank <= 3 ? AwardIcon : () => <div className="w-4" />;

  return (
    <>

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
          <Hexagon
            className={cn(
              "absolute left-0 top-0 -z-10 h-15 w-15",
              colorClass
            )}
          />


          <Hexagon className="relative left-1 top-1 h-13 w-13 ">

            {isTop3 && (
              <>
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r bg-[linear-gradient(63deg,rgba(250,250,250,.8)_10%,transparent_40%,transparent_100%)] z-10" />
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-r bg-[linear-gradient(113deg,rgba(250,250,250,.8)_10%,transparent_40%,transparent_100%)] z-10" />
                <div
                  className="absolute z-10 w-15 h-15 rotate-[150deg] pointer-events-none bg-[linear-gradient(90deg,transparent_30%,rgba(250,250,250)_50%,transparent_60%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[-100%_0] bg-no-repeat"
                  style={{
                    animation: "shine 2s ease-in-out infinite",
                  }}
                />
              </>
            )}

            <Image
              src={imageUrl}
              alt="competition"
              fill
              className="object-cover w-full top-0 left-0 rotate-270"
            />

          </Hexagon>
        </div>
      </Tooltip>
    </>
  );
};

