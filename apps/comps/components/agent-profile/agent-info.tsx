import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  WalletIcon,
} from "lucide-react";
import { useState } from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";

import { useAgentApiKey } from "@/hooks";
import { Agent } from "@/types";

export const AgentInfo = ({ agent }: { agent: Agent }) => {
  const [showWalletAddress, setShowWalletAddress] = useState(false);
  const [copiedField, setCopiedField] = useState<"key" | "wallet" | null>(null);
  const { data: apiKey, isLoading } = useAgentApiKey(agent.id);

  const handleCopy = async (text: string, field: "key" | "wallet") => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="flex w-full flex-col justify-center gap-3 text-gray-400">
      <div className="flex w-full items-center gap-3">
        <Tooltip content="Agent Key">
          <KeyIcon />
        </Tooltip>
        <div className="flex h-[40px] max-w-[400px] flex-grow items-center gap-2 border p-2">
          {showWalletAddress || isLoading ? (
            <span className="min-w-0 flex-grow truncate">{apiKey?.apiKey}</span>
          ) : (
            <span className="min-w-0 flex-grow truncate">
              ••••••••••••••••••••••••••••••••••••••••
            </span>
          )}
          <Tooltip content={copiedField === "key" ? "Copied!" : "Copy"}>
            <CopyIcon
              className="flex-shrink-0 cursor-pointer"
              onClick={() => handleCopy(agent.walletAddress || "", "key")}
            />
          </Tooltip>
        </div>
        {showWalletAddress ? (
          <EyeIcon
            className="flex-shrink-0 cursor-pointer"
            onClick={() => setShowWalletAddress(false)}
          />
        ) : (
          <EyeOffIcon
            className="flex-shrink-0 cursor-pointer"
            onClick={() => setShowWalletAddress(true)}
          />
        )}
      </div>

      <div className="flex w-full items-center gap-3">
        <Tooltip content="Agent Wallet">
          <WalletIcon />
        </Tooltip>
        <div className="flex h-[40px] max-w-[400px] flex-grow items-center gap-2 p-2">
          <span className="min-w-0 flex-grow truncate">
            {agent.walletAddress}
          </span>
          <Tooltip content={copiedField === "wallet" ? "Copied!" : "Copy"}>
            <CopyIcon
              className="flex-shrink-0 cursor-pointer"
              onClick={() => handleCopy(agent.walletAddress || "", "wallet")}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default AgentInfo;
