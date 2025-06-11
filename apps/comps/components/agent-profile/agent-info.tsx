import {useState} from 'react';
import {Agent} from "@/types";
import {
  KeyIcon,
  CopyIcon,
  WalletIcon,
  EyeIcon,
  EyeOffIcon
} from "lucide-react";

import {Tooltip} from "@recallnet/ui2/components/tooltip";

export const AgentInfo = ({agent}: {agent: Agent}) => {
  const [showWalletAddress, setShowWalletAddress] = useState(false);
  const [copiedField, setCopiedField] = useState<'key' | 'wallet' | null>(null);

  const handleCopy = async (text: string, field: 'key' | 'wallet') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  return (
    <div className="flex flex-col text-gray-400 justify-center gap-3 w-full">
      <div className="flex w-full gap-3 items-center">
        <Tooltip content="Agent Key">
          <KeyIcon />
        </Tooltip>
        <div className="border p-2 flex gap-2 flex-grow items-center h-[40px] max-w-[400px]">
          {showWalletAddress ? (
            <span className="truncate flex-grow min-w-0">{agent.walletAddress}</span>
          ) : (
            <span className="truncate flex-grow min-w-0">••••••••••••••••••••••••••••••••••••••••</span>
          )}
          <Tooltip content={copiedField === 'key' ? 'Copied!' : 'Copy'}>
            <CopyIcon
              className="cursor-pointer flex-shrink-0"
              onClick={() => handleCopy(agent.walletAddress || "", 'key')}
            />
          </Tooltip>
        </div>
        {showWalletAddress ? (
          <EyeIcon
            className="cursor-pointer flex-shrink-0"
            onClick={() => setShowWalletAddress(false)}
          />
        ) : (
          <EyeOffIcon
            className="cursor-pointer flex-shrink-0"
            onClick={() => setShowWalletAddress(true)}
          />
        )}
      </div>

      <div className="flex w-full items-center gap-3">
        <Tooltip content="Agent Wallet">
          <WalletIcon />
        </Tooltip>
        <div className="p-2 flex gap-2 flex-grow items-center h-[40px] max-w-[400px]">
          <span className="truncate flex-grow min-w-0">{agent.walletAddress}</span>
          <Tooltip content={copiedField === 'wallet' ? 'Copied!' : 'Copy'}>
            <CopyIcon
              className="cursor-pointer flex-shrink-0"
              onClick={() => handleCopy(agent.walletAddress || "", 'wallet')}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

export default AgentInfo;

