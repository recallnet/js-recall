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

import { usePrivyAuth } from "@/hooks/usePrivyAuth";

interface ConnectPrivyModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

export const ConnectPrivyModal: React.FC<ConnectPrivyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { login, isAuthenticating, authError, clearError } = usePrivyAuth();

  const handleConnect = async () => {
    clearError();
    try {
      login();
      onClose(false);
      return true;
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <WalletIcon className="size-6 text-gray-700" />
            Connect Your Account
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            To continue, please connect your account.
          </DialogDescription>
          <p className="mt-[-0.5rem] pl-8 text-sm text-gray-500">
            You can connect with your wallet, Google, GitHub, or email.
          </p>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        {authError && (
          <div className="rounded-md border border-red-500 bg-red-900/20 p-3">
            <p className="text-sm text-red-400">{authError}</p>
          </div>
        )}

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
              onClick={handleConnect}
              disabled={isAuthenticating}
              className="rounded-lg bg-white text-black hover:bg-gray-300 disabled:opacity-50"
            >
              {isAuthenticating ? "Connecting..." : "Connect Account"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPrivyModal;
