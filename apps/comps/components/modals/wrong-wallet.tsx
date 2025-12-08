import { AlertTriangle, ExternalLink } from "lucide-react";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";

import { ConnectWallet } from "@/components/connect-wallet";
import { CopyButton } from "@/components/copy-button";
import { displayAddress } from "@/utils/address";

interface WrongWalletModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  expectedWalletAddress: string;
}

export const WrongWalletModal: React.FC<WrongWalletModalProps> = ({
  isOpen,
  onClose,
  expectedWalletAddress,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-[600px] p-4 sm:p-6">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <AlertTriangle className="size-6 text-yellow-500" />
            Wrong Wallet Connected
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            You need to connect the wallet address you used when signing up.
          </DialogDescription>
          <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
            Please connect the correct wallet to continue.
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
            <h4 className="mb-2 text-sm font-medium text-gray-300">
              Expected Wallet Address:
            </h4>
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-white">
                <span className="xs:hidden">
                  {displayAddress(expectedWalletAddress, { numChars: 8 })}
                </span>
                <span className="xs:inline hidden">
                  {expectedWalletAddress}
                </span>
              </span>
              <CopyButton textToCopy={expectedWalletAddress} />
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-400">
            <ExternalLink className="h-4 w-4" />
            <span>
              Switch to the correct wallet in your wallet provider, then click
              &quot;Connect Wallet&quot; below.
            </span>
          </div>
        </div>

        <DialogFooter className="flex justify-end gap-3">
          <DialogClose asChild>
            <Button
              variant="outline"
              className="h-14"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
          </DialogClose>
          <ConnectWallet />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WrongWalletModal;
