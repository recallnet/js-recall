"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui/components/shadcn/dialog";

import { useLogout, useUserSession } from "../hooks";

/**
 * SignIn button component that mirrors the comps app pattern
 * Uses RainbowKit with SIWE authentication via external API
 */
export function SignInButton() {
  const logout = useLogout();
  const session = useUserSession();
  const { disconnect } = useDisconnect();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleSimpleLogout = async () => {
    setShowLogoutDialog(false);
    logout.mutate();
  };

  const handleFullLogout = async () => {
    setShowLogoutDialog(false);
    // First disconnect the wallet, then logout the app
    disconnect();
    logout.mutate();
  };

  if (!session.isInitialized) {
    return null;
  }

  const { user } = session;

  // Show authenticated state with logout option
  if (user) {
    return (
      <>
        <Button
          variant="outline"
          onClick={() => setShowLogoutDialog(true)}
          disabled={logout.isPending}
          className="w-full rounded-none border border-[#303846] bg-transparent py-5 transition-colors hover:bg-[#0e1218]"
        >
          {logout.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Logging Out...
            </>
          ) : (
            <div className="flex items-center justify-center space-x-2">
              <LogOut className="h-4 w-4" />
              <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89]">
                Log Out ({user.walletAddress.slice(0, 6)}...
                {user.walletAddress.slice(-4)})
              </span>
            </div>
          )}
        </Button>

        <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <DialogContent className="max-w-md border border-[#1a1a1a] bg-[#0a0a0a]">
            <DialogHeader>
              <DialogTitle className="font-['Replica_LL',sans-serif] text-xl font-bold text-[#E9EDF1]">
                Log Out Options
              </DialogTitle>
              <DialogDescription className="text-[#596E89]">
                Choose how you&apos;d like to log out of your account.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-6 space-y-4">
              <div className="space-y-3">
                <Button
                  onClick={handleSimpleLogout}
                  disabled={logout.isPending}
                  className="w-full bg-[#0057AD] py-3 text-white hover:bg-[#0066cc]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out (Keep Wallet Connected)
                </Button>
                <p className="px-2 text-xs text-[#6D85A4]">
                  Clears your session but keeps wallet connected for quick
                  sign-in.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleFullLogout}
                  disabled={logout.isPending}
                  variant="outline"
                  className="w-full border border-[#303846] bg-transparent py-3 text-[#E9EDF1] hover:bg-[#1a1a1a]"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log Out + Disconnect Wallet
                </Button>
                <p className="px-2 text-xs text-[#6D85A4]">
                  Clears session and disconnects wallet. You&apos;ll need to
                  reconnect next time.
                </p>
              </div>

              <Button
                onClick={() => setShowLogoutDialog(false)}
                variant="ghost"
                className="mt-4 w-full text-[#596E89] hover:text-[#E9EDF1]"
              >
                Cancel
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Show connect/sign-in button using RainbowKit
  return (
    <ConnectButton.Custom>
      {({ account, openConnectModal, authenticationStatus, mounted }) => {
        // Not mounted in SSR
        if (!mounted) {
          return (
            <Button
              className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
              disabled
            >
              <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
                Loading...
              </span>
            </Button>
          );
        }

        // If wallet is connected but not authenticated, show "Sign In"
        if (account && authenticationStatus !== "authenticated") {
          return (
            <Button
              onClick={openConnectModal}
              className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
            >
              <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
                Sign In
              </span>
            </Button>
          );
        }

        // If no wallet connected, show "Connect Wallet"
        return (
          <Button
            onClick={openConnectModal}
            className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          >
            <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
              Connect Wallet
            </span>
          </Button>
        );
      }}
    </ConnectButton.Custom>
  );
}
