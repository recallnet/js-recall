import Image from "next/image";
import Link from "next/link";

import { cn } from "@recallnet/ui2/lib/utils";

import { AgentCompetition } from "../types/agent";
import { Identicon } from "./identicon";

interface ParticipantsAvatarsProps {
  agents: AgentCompetition[];
  maxDisplay?: number;
  className?: string;
}

export function ParticipantsAvatars({
  agents,
  maxDisplay = 3,
  className,
}: ParticipantsAvatarsProps) {
  const displayAgents = agents.slice(0, maxDisplay);
  const remainingCount = Math.max(0, agents.length - maxDisplay);

  if (agents.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {displayAgents.map((agent) => (
        <Link
          key={agent.id}
          href={`/agents/${agent.id}`}
          className="group relative transition-transform duration-200 hover:z-10 hover:scale-110"
        >
          {agent.imageUrl ? (
            <Image
              src={agent.imageUrl}
              alt={agent.name}
              fill
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <Identicon address={agent.id} className="h-8 w-8" size={32} />
          )}
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
