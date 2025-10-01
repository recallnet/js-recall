import { ArrowUpRight, AwardIcon, Trophy } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { Hexagon } from "@/components/hexagon";

export type Trophy = {
  competitionId: string;
  rank: number;
  imageUrl: string;
  name: string;
  createdAt: string;
};

interface TrophyBadgeProps {
  trophy: Trophy;
  size?: number;
}

const DEFAULT_SIZE = 64;
const BORDER_THICKNESS = 2;
const IMAGE_ZOOM = 1.2;
const ASPECT_RATIO_HEIGHT_FACTOR = 0.859375;

const rankColors: Record<number, string> = {
  1: "bg-trophy-first",
  2: "bg-trophy-second",
  3: "bg-trophy-third",
};

const getDimensions = (size: number | undefined) => {
  const effectiveW = size || DEFAULT_SIZE;
  const effectiveH = effectiveW * ASPECT_RATIO_HEIGHT_FACTOR;
  const borderThickness = BORDER_THICKNESS;

  const innerW = effectiveW - borderThickness * 2;
  const innerH = effectiveH - borderThickness * 2;

  return {
    outerW: effectiveW,
    outerH: effectiveH,
    innerW: innerW,
    innerH: innerH,
    borderThickness: borderThickness,
    imageZoom: IMAGE_ZOOM, // Pass the zoom level
  };
};

export const TrophyBadge: React.FC<TrophyBadgeProps> = ({ trophy, size }) => {
  const { competitionId, rank, imageUrl, name } = trophy;
  const router = useRouter();
  const isTop3 = rank >= 1 && rank <= 3;
  const colorClass = rankColors[rank] || "bg-gray-700";
  const Icon =
    rank === 1 ? Trophy : rank <= 3 ? AwardIcon : () => <div className="w-4" />;

  const { outerW, outerH, innerW, innerH, borderThickness, imageZoom } =
    getDimensions(size);

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
        <div
          className="group relative cursor-pointer"
          onClick={() => router.push(`/competitions/${competitionId}`)}
          style={{
            height: outerH,
            width: outerW,
          }}
        >
          <Hexagon
            style={{
              height: outerH,
              width: outerW,
            }}
            className={cn(
              "absolute left-0 top-0 -z-10",
              "duration-330 transition-transform group-hover:scale-110",
              colorClass,
            )}
          />
          <Hexagon
            style={{
              height: innerH,
              width: innerW,
            }}
            className={cn(
              `relative left-[${borderThickness}px] top-[${borderThickness}px]`,
              "duration-330 transition-transform ease-in-out group-hover:scale-110",
            )}
          >
            {isTop3 && (
              <>
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(63deg,rgba(250,250,250,.8)_10%,transparent_40%,transparent_100%)] bg-gradient-to-r" />
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(113deg,rgba(250,250,250,.8)_10%,transparent_40%,transparent_100%)] bg-gradient-to-r" />
                <div
                  className="w-15 h-15 pointer-events-none absolute z-10 rotate-[150deg] bg-[linear-gradient(90deg,transparent_30%,rgba(250,250,250)_50%,transparent_60%,transparent_100%)] bg-[length:250%_250%,100%_100%] bg-[-100%_0] bg-no-repeat"
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
              className="rotate-270 left-0 top-0 w-full object-cover"
              style={{
                transform: `scale(${imageZoom})`, // Dynamically set scale
              }}
            />
          </Hexagon>
        </div>
      </Tooltip>
    </>
  );
};
