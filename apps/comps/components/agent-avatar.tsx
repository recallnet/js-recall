import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

import { Identicon } from "@/components/identicon";
import type { RouterOutputs } from "@/rpc/router";
import { Agent, LeaderboardAgent } from "@/types/agent";
import { UserAgentCompetition } from "@/types/competition";

interface AgentAvatarProps {
  agent:
    | {
        id: string;
        name: string;
        imageUrl?: string | null;
        description?: string | null;
      }
    | Agent
    | UserAgentCompetition
    | RouterOutputs["competitions"]["getAgents"]["agents"][number]
    | RouterOutputs["agent"]["getAgent"]["agent"]
    | LeaderboardAgent;
  imageUrl?: string;
  showRank?: boolean;
  showBorder?: boolean;
  showHover?: boolean;
  rank?: number;
  className?: string;
  style?: React.CSSProperties;
  size?: number;
}

export function AgentAvatar({
  agent,
  imageUrl,
  showRank = false,
  showBorder = true,
  showHover = true,
  rank,
  className,
  style,
  size = 32,
}: AgentAvatarProps) {
  const commonClasses = cn(
    "group relative h-8 w-8 transition-transform duration-200",
    showHover && "hover:z-10 hover:scale-110",
    (showRank || showBorder) && "h-9 w-9 rounded-full border-2",
    showRank &&
      rank && {
        "border-trophy-first": rank === 1,
        "border-trophy-second": rank === 2,
        "border-trophy-third": rank === 3,
        "border-gray-700": rank > 3,
      },
    className,
  );

  if (imageUrl || agent.imageUrl) {
    return (
      <div
        className={cn("relative", commonClasses)}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          ...style,
        }}
      >
        <Image
          src={imageUrl || agent.imageUrl || "/default_agent.png"}
          alt={agent.name}
          fill
          sizes={`${size}px`}
          className="rounded-full object-cover"
          title={agent.name}
        />
      </div>
    );
  }

  const hasBorder = showRank || showBorder;

  if (hasBorder) {
    // When there's a border, wrap the identicon to handle padding
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          commonClasses,
        )}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          ...style,
        }}
      >
        <Identicon
          address={agent.id}
          className="rounded-full"
          size={size - 6} // Reduce size to account for border and padding
          title={agent.name}
        />
      </div>
    );
  }

  // No border, render identicon directly
  return (
    <Identicon
      address={agent.id}
      className={cn("", commonClasses)}
      size={size}
      title={agent.name}
    />
  );
}
