import Link from "next/link";

import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { Agent, AgentCompetition } from "@/types/agent";
import { UserAgentCompetition } from "@/types/competition";

interface ParticipantsAvatarsProps {
  agents: Agent[] | UserAgentCompetition[] | AgentCompetition[];
  compId?: string;
  maxDisplay?: number;
  className?: string;
  showRank?: boolean;
  showBorder?: boolean;
}

export function ParticipantsAvatars({
  agents,
  maxDisplay = 3,
  className,
  compId,
  showRank = false,
  showBorder = true,
}: ParticipantsAvatarsProps) {
  const displayAgents = agents.slice(0, maxDisplay);
  const remainingCount = Math.max(0, agents.length - maxDisplay);

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {displayAgents.map((agent, index) => (
        <Link
          href={compId ? `/competitions/${compId}` : `/agents/${agent.id}`}
          key={agent.id}
        >
          <AgentAvatar
            key={agent.id}
            agent={agent}
            showRank={showRank}
            showBorder={showBorder}
            rank={showRank ? getRank(agent, index) : undefined}
            size={32}
          />
        </Link>
      ))}
      {remainingCount > 0 && (
        <div className="text-secondary-foreground flex h-8 items-center justify-center rounded-full bg-gray-800 px-2 text-sm">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}

function getRank(
  agent: Agent | UserAgentCompetition | AgentCompetition,
  index: number,
) {
  if ("rank" in agent) {
    return agent.rank;
  }

  if ("stats" in agent && agent.stats) {
    return agent.stats.bestPlacement?.rank || 0;
  }

  return index + 1;
}
