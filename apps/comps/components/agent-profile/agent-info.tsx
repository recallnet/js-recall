import {
  CopyIcon,
  EyeIcon,
  EyeOffIcon,
  KeyIcon,
  WalletIcon,
} from "lucide-react";
import {useState} from "react";
import {useCopyToClipboard} from "@uidotdev/usehooks";

import {Tooltip} from "@recallnet/ui2/components/tooltip";

import {useAgentApiKey} from "@/hooks";
import {Agent} from "@/types";
import {Clipboard} from "../clipboard";

export const AgentInfo = ({agent}: {agent: Agent}) => {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [showWalletAddress, setShowWalletAddress] = useState(false);
  const {data: apiKey, isLoading} = useAgentApiKey(agent.id);

  const handleCopy = async (text: string) => {
    copyToClipboard(text);
    setTimeout(() => copyToClipboard(null), 1500);
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
          <Tooltip content={copiedText === apiKey?.apiKey ? "Copied!" : "Copy"}>
            <CopyIcon
              className="flex-shrink-0 cursor-pointer translate-y-1"
              onClick={() => handleCopy(apiKey?.apiKey || "")}
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
        <Clipboard text={agent.walletAddress || ""} className='py-1 px-2 max-w-[400px] flex-grow' />
      </div>
    </div>
  );
};

export default AgentInfo;
