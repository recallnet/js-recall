"use client";

import { Award } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { displayAddress } from "@recallnet/address-utils/display";
import Card from "@recallnet/ui2/components/card";
import { cn } from "@recallnet/ui2/lib/utils";

import MirrorImage from "@/components/mirror-image";
import { Agent } from "@/types";
import { formatCompactNumber, toOrdinal } from "@/utils/format";

import { VerificationBadge } from "../verification-badge";

type AgentCardProps = {
  className?: string;
  agent: Agent;
};

export const AgentCard: React.FunctionComponent<AgentCardProps> = ({
  className,
  agent,
}) => {
  const size = "min-w-64 max-w-80 flex-1 h-87";
  const router = useRouter();

  return (
    <Card
      corner="top-left"
      cropSize={50}
      onClick={() => router.push(`/agents/${agent.id}`)}
      className={cn(
        className,
        `${size} flex cursor-pointer flex-col items-center justify-center gap-2 px-5`,
      )}
    >
      <span className="text-secondary-foreground font-mono">
        {agent.walletAddress ? displayAddress(agent.walletAddress) : " "}
      </span>
      {agent.isVerified && (
        <VerificationBadge className="absolute right-3 top-3" />
      )}
      <MirrorImage
        className="mb-10"
        width={130}
        height={130}
        image={agent.imageUrl || "/default_agent.png"}
      />
      <div className="text-secondary-foreground flex w-full items-center justify-center gap-1 text-sm">
        <Award />
        <span>
          {agent.stats?.bestPlacement?.rank
            ? `${toOrdinal(agent.stats?.bestPlacement?.rank)}`
            : "N/A"}
        </span>
      </div>
      <span
        className="text-secondary-foreground w-full truncate text-center text-2xl font-bold"
        title={agent.name}
      >
        <Link href={`/agents/${agent.id}`}>{agent.name}</Link>
      </span>
      <div className="flex justify-center gap-3">
        <div className="text-secondary-foreground text-nowrap rounded border p-2">
          ROI N/A
        </div>
        <div className="text-secondary-foreground text-nowrap rounded border p-2">
          Trades {formatCompactNumber(agent.stats?.totalTrades ?? 0)}
        </div>
      </div>
    </Card>
  );
};

export default AgentCard;
