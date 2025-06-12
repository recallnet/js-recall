import Image from "next/image";
import Link from "next/link";

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
  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cn(
        "group relative transition-transform duration-200 hover:z-10 hover:scale-110",
        showRank && "rounded-full border-2",
        showRank && rank && getRankColor(rank),
        className,
      )}
      title={agent.name}
    >
      {agent.imageUrl ? (
        <Image
          src={agent.imageUrl}
          alt={agent.name}
          fill
          className="h-8 w-8 rounded-full object-cover"
        />
      ) : (
        <Identicon address={agent.id} className="h-8 w-8" size={size} />
      )}
    </Link>
  );
}
