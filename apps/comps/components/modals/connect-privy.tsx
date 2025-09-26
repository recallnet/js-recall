import { WalletIcon } from "lucide-react";
import React, { useEffect } from "react";

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

import { useSession } from "@/hooks/useSession";

interface ConnectPrivyModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
}

/**
 * Modal prompting the user to authorize their session.
 * Displays helpful guidance when backend requests return 401s or when a wallet
 * connection request is declined. It keeps the modal open while the auth flow
 * is in progress and closes automatically once the user is authenticated.
 *
 * @param isOpen - Whether the modal is visible
 * @param onClose - Callback to request closing the modal
 */
export const ConnectPrivyModal: React.FC<ConnectPrivyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { login, isPending, error, isAuthenticated } = useSession();

  // Close the modal once the user is authenticated to avoid leaving an empty frame
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      onClose(false);
    }
  }, [isAuthenticated, isOpen, onClose]);

  const handleConnect = () => {
    // Start the Privy auth flow. The modal will auto-close on success via the effect above.
    login();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[600px]">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center justify-start gap-2 text-xl font-bold text-white">
            <WalletIcon className="size-6 text-gray-700" />
            Authorization required
          </DialogTitle>
          <DialogDescription className="pl-8 text-gray-400">
            Your session could not be verified. This can happen if a wallet
            prompt was declined or if your session needs to be refreshed.
          </DialogDescription>
          <ul className="mt-[-0.25rem] list-disc space-y-1 pl-12 text-sm text-gray-500">
            <li>
              Choose “Connect Account” and approve the prompt to continue.
            </li>
            <li>You can also sign in with Google or email in the next step.</li>
            <li>
              If you recently declined a wallet request, retry and approve it.
            </li>
          </ul>
        </DialogHeader>

        <div className="border-t-1 border-gray-500"></div>

        {error && (
          <div className="rounded-md border border-red-500 bg-red-900/20 p-3">
            <p className="text-sm text-red-400">
              {error.message ||
                "There was a problem starting the sign-in flow."}
            </p>
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
              disabled={isPending}
              className="rounded-lg bg-white text-black hover:bg-gray-300 disabled:opacity-50"
            >
              {isPending ? "Connecting..." : "Connect Account"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectPrivyModal;
