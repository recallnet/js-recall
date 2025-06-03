import React from 'react';
import {WalletIcon} from 'lucide-react';
import {ConnectButton} from "@rainbow-me/rainbowkit";

import {Button} from "@recallnet/ui2/components/button"; // Path to your dialog component
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
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
      {({openConnectModal}) => (
        <Dialog open={isOpen} onOpenChange={onClose}>
          <DialogContent className="w-[600px]">
            <DialogHeader className="text-start">
              <DialogTitle className="flex justify-start gap-2 text-xl font-bold text-white">
                <WalletIcon className="size-6 text-gray-700" />
                Connect Your Wallet
              </DialogTitle>
              <DialogDescription className="text-gray-400 pl-8">
                To continue, please connect your wallet.
              </DialogDescription>
              <p className="text-sm text-gray-500 mt-[-0.5rem] pl-8">
                You’ll be asked to select your wallet provider.
              </p>
            </DialogHeader>

            <div className="border-t-1 border-gray-500"></div>

            <DialogFooter className="flex justify-end">
              <DialogClose asChild>
                <Button
                  variant="outline"
                  className="bg-transparent text-gray-500 border-gray-700 hover:bg-gray-900 rounded-lg"
                  onClick={() => onClose(false)}
                >
                  Cancel
                </Button>
              </DialogClose>
              <div className="flex items-center">
                <Button
                  onClick={() => {
                    onClose(false)
                    openConnectModal()
                  }}
                  className="bg-white text-black hover:bg-gray-300 rounded-lg"
                >
                  JOIN / SIGN IN
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
