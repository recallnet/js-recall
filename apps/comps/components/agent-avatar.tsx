import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

import { Identicon } from "@/components/identicon";
import { Agent, AgentCompetition } from "@/types/agent";
import { UserAgentCompetition } from "@/types/competition";

interface AgentAvatarProps {
  agent: Agent | UserAgentCompetition | AgentCompetition;
  showRank?: boolean;
  rank?: number;
  className?: string;
  size?: number;
}

export function AgentAvatar({
  agent,
  showRank = false,
  rank,
  className,
  size = 32,
}: AgentAvatarProps) {
  const commonClasses = cn(
    "group relative h-8 w-8 transition-transform duration-200 hover:z-10 hover:scale-110",
    showRank && "h-9 w-9 rounded-full border-2 bg-gray-700",
    showRank &&
      rank && {
        "border-yellow-800": rank === 1,
        "border-gray-700": rank === 2 || rank > 3,
        "border-[#1A0E05]": rank === 3,
      },
    className,
  );

  if (agent.imageUrl) {
    return (
      <div
        className={cn("relative", commonClasses)}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
        }}
      >
        <Image
          src={agent.imageUrl || "/default_agent.png"}
          alt={agent.name}
          fill
          sizes={`${size}px`}
          className="rounded-full object-cover"
          title={agent.name}
        />
      </div>
    );
  }

  const identicon = (
    <Identicon
      address={agent.id}
      className={cn("", commonClasses)}
      size={size}
      title={agent.name}
    />
  );

  return identicon;
}
