import { cn } from "@recallnet/ui2/lib/utils";

import { AgentAvatar } from "@/components/agent-avatar";
import { Agent, AgentCompetition } from "@/types/agent";
import { UserAgentCompetition } from "@/types/competition";

interface ParticipantsAvatarsProps {
  agents: Agent[] | UserAgentCompetition[] | AgentCompetition[];
  maxDisplay?: number;
  className?: string;
  showRank?: boolean;
}

export function ParticipantsAvatars({
  agents,
  maxDisplay = 3,
  className,
  showRank = false,
}: ParticipantsAvatarsProps) {
  const displayAgents = agents.slice(0, maxDisplay);
  const remainingCount = Math.max(0, agents.length - maxDisplay);

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {displayAgents.map((agent, index) => (
        <AgentAvatar
          key={agent.id}
          agent={agent}
          showRank={showRank}
          rank={showRank ? index + 1 : undefined}
          size={32}
        />
      ))}
      {remainingCount > 0 && (
        <div className="text-secondary-foreground flex h-8 items-center justify-center rounded-full bg-gray-800 px-2 text-sm">
          +{remainingCount}
        </div>
      )}
    </div>
  );
}
