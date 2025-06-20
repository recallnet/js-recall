import { useCopyToClipboard } from "@uidotdev/usehooks";
import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  WalletIcon,
} from "lucide-react";
import { useState } from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { useAgentApiKey } from "@/hooks";
import { Agent } from "@/types";

import { Clipboard } from "../clipboard";

export const AgentInfo = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [showApiKey, setShowApiKey] = useState(false);
  const { data: apiKey, isLoading } = useAgentApiKey(agent.id);

  const handleCopy = async (text: string) => {
    copyToClipboard(text);
    setTimeout(() => copyToClipboard(""), 1500);
  };

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
      <div className="flex w-full max-w-[470px] items-center gap-3">
        <Tooltip content="Agent API Key">
          <KeyIcon />
        </Tooltip>
        <div className="flex h-[40px] w-full items-center gap-2 overflow-hidden rounded border p-2">
          {showApiKey || isLoading ? (
            <span className="flex-grow truncate">{apiKey?.apiKey}</span>
          ) : (
            <span className="flex-grow truncate">
              ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
            </span>
          )}
          <Tooltip content={copiedText === apiKey?.apiKey ? "Copied!" : "Copy"}>
            <CopyIcon
              className="flex-shrink-0 translate-y-1 cursor-pointer"
              onClick={() => handleCopy(apiKey?.apiKey || "")}
            />
          </Tooltip>
        </div>
        {showApiKey ? (
          <EyeIcon
            className="flex-shrink-0 cursor-pointer"
            onClick={() => setShowApiKey(false)}
          />
        ) : (
          <EyeOffIcon
            className="flex-shrink-0 cursor-pointer"
            onClick={() => setShowApiKey(true)}
          />
        )}
      </div>

      <div className="flex w-full max-w-[470px] items-center gap-3">
        <Tooltip content="Agent Wallet Address">
          <WalletIcon />
        </Tooltip>
        <Clipboard
          text={agent.walletAddress || ""}
          className="w-full flex-grow px-2 py-1"
        />
        {
          // just to align components
        }
        <EyeIcon className="opacity-0" />
      </div>
    </div>
  );
};

export default AgentInfo;
