import Image from "next/image";

import { cn } from "@recallnet/ui2/lib/utils";

import { Identicon } from "@/components/identicon";
import { getRankColor } from "@/lib/rank-colors";
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
    showRank && "h-9 w-9 rounded-full border-2",
    showRank && rank && getRankColor(rank),
    className,
  );

  if (agent.imageUrl) {
    return (
      <Image
        src={agent.imageUrl}
        alt={agent.name}
        fill
        className={cn("rounded-full object-cover", commonClasses)}
        title={agent.name}
      />
    );
  }

  const identicon = (
    <Identicon
      address={agent.id}
      className={cn("", commonClasses)}
      size={size}
    />
  );

  return identicon;
}
