import { WalletIcon } from "lucide-react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { Agent } from "@/types";

import { Clipboard } from "../clipboard";

export const AgentInfo = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
      {agent.walletAddress && (
        <div className="flex w-full items-center gap-4">
          <Tooltip content="Agent Wallet Address">
            <WalletIcon />
          </Tooltip>
          <Clipboard text={agent.walletAddress || ""} />
        </div>
      )}
    </div>
  );
};

export default AgentInfo;
