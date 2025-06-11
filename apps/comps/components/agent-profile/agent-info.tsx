import {useState} from 'react';
import {Agent} from "@/types";
import {KeyIcon, CopyIcon, WalletIcon, ArrowUpRight, EyeIcon, EyeOffIcon} from "lucide-react";

import {Tooltip} from "@recallnet/ui2/components/tooltip";

export const AgentInfo = ({agent}: {agent: Agent}) => {
  const [showWalletAddress, setShowWalletAddress] = useState(false);

  return (
    <div className="flex flex-col text-gray-400 justify-center gap-3 w-full">
      {/* First Field: Key Icon with Tooltip, Wallet Address with Toggle and Copy */}
      <div className="flex w-full gap-3 items-center">
        <Tooltip content="Agent Key"> {/* Tooltip for KeyIcon */}
          <KeyIcon />
        </Tooltip>
        <div className="border p-2 flex gap-2 flex-grow items-center overflow-hidden"> {/* Added overflow-hidden */}
          {/* Conditional rendering for wallet address */}
          {showWalletAddress ? (
            // The span for the address needs 'min-w-0' to allow truncation within a flex container
            <span className="truncate flex-grow min-w-0">{agent.walletAddress}</span>
          ) : (
            <span className="truncate flex-grow min-w-0">••••••••••••••••••••••••••••••••••••••••</span> // Masked version
          )}

          {/* Eye Icon for toggling visibility */}
          {showWalletAddress ? (
            <EyeOffIcon
              className="cursor-pointer flex-shrink-0" // Added flex-shrink-0
              onClick={() => setShowWalletAddress(false)}
            />
          ) : (
            <EyeIcon
              className="cursor-pointer flex-shrink-0" // Added flex-shrink-0
              onClick={() => setShowWalletAddress(true)}
            />
          )}
          <Tooltip content="Copy to clipboard"> {/* Tooltip for CopyIcon */}
            <CopyIcon className="cursor-pointer flex-shrink-0" /> {/* Added flex-shrink-0 */}
          </Tooltip>
        </div>
      </div>

      {/* Second Field: Wallet Icon with Tooltip, Wallet Address with External Link */}
      <div className="flex w-full items-center gap-3">
        <Tooltip content="Agent Wallet"> {/* Tooltip for WalletIcon */}
          <WalletIcon />
        </Tooltip>
        <div className="border p-2 flex gap-2 flex-grow items-center overflow-hidden"> {/* Added overflow-hidden */}
          {/* The span for the address needs 'min-w-0' to allow truncation within a flex container */}
          <span className="truncate flex-grow min-w-0">{agent.walletAddress}</span>
          <Tooltip content="View on explorer"> {/* Tooltip for ArrowUpRight */}
            <ArrowUpRight className="cursor-pointer flex-shrink-0" /> {/* Added flex-shrink-0 */}
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

export default AgentInfo;
