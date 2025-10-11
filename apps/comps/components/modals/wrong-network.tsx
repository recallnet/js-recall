import { AlertTriangle, ExternalLink } from "lucide-react";
import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { SwitchChain } from "@/components/switch-chain";

interface WrongNetworkModalProps {
  isOpen: boolean;
  currentChainId: number;
  expectedChainId: number;
}

export const WrongNetworkModal: React.FC<WrongNetworkModalProps> = ({
  isOpen,
  currentChainId,
  expectedChainId,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent
        className="w-full max-w-[600px] p-4 sm:p-6"
        showCloseButton={false}
      >
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <AlertTriangle className="size-6 text-yellow-500" />
            Wrong Network Connected
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            You need to switch to the correct network to continue.
          </DialogDescription>
          <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
            Please switch to the expected network below.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-300">
              Current Network:
            </h4>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-white">
                Chain ID: {currentChainId}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-300">
              Expected Network:
            </h4>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-white">
                Chain ID: {expectedChainId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ExternalLink className="h-4 w-4" />
            <span>
              Click the button below to switch to the correct network.
            </span>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3">
          <SwitchChain chainId={expectedChainId} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WrongNetworkModal;
