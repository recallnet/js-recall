import { ConnectButton } from "@rainbow-me/rainbowkit";
import { WalletIcon } from "lucide-react";
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

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

export const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
}) => {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="w-[600px]">
            <DialogHeader className="text-start">
              <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
                <WalletIcon className="size-6 text-gray-700" />
                Connect Your Wallet
              </DialogTitle>
              <DialogDescription className="pl-8 text-gray-400">
                To continue, please connect your wallet.
              </DialogDescription>
              <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
                You&apos;ll be asked to select your wallet provider.
              </p>
            </DialogHeader>

            <div className="border-t-1 border-gray-500"></div>

            <DialogFooter className="flex justify-end">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="rounded-lg border-gray-700 bg-transparent text-gray-500 hover:bg-gray-900"
                  onClick={() => onClose(false)}
                >
                  Cancel
                </Button>
              </DialogClose>
              <div className="flex items-center">
                <Button
                  onClick={() => {
                    onClose(false);
                    openConnectModal();
                  }}
                  className="rounded-lg bg-white text-black hover:bg-gray-300"
                >
                  Connect Wallet
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </ConnectButton.Custom>
  );
};

export default ConnectWalletModal;
