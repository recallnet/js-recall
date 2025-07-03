"use client";

import { ConnectKitButton } from "connectkit";
import { LogOut } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useLogout, useUserSession } from "../hooks";
import { useSiweAuth } from "../hooks/useSiweAuth";

/**
 * SignIn button component using ConnectKit
 * Handles the full authentication flow: connect wallet -> sign message -> authenticate
 */
export function SignInButton() {
  const logout = useLogout();
  const session = useUserSession();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticate, isAuthenticating, authError } = useSiweAuth();

  const handleLogout = async () => {
    try {
      // First logout from backend (clears session/cookies)
      await logout.mutateAsync();
      // Then disconnect the wallet to prevent auto re-authentication
      disconnect();
    } catch (error) {
      console.error("Logout failed:", error);
      // Still disconnect wallet even if backend logout fails
      disconnect();
    }
  };

  const handleSignMessage = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error("Manual authentication failed:", error);
    }
  };

  if (!session.isInitialized) {
    return null;
  }

  const { user } = session;

  // Show authenticated state with logout (both session and wallet)
  if (user) {
    return (
      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={logout.isPending}
        className="w-full rounded-none border border-[#303846] bg-transparent py-5 transition-colors hover:bg-[#0e1218]"
      >
        <div className="flex items-center justify-center space-x-2">
          <LogOut className="h-4 w-4" />
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89]">
            {logout.isPending
              ? "Logging Out..."
              : `Log Out (${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)})`}
          </span>
        </div>
      </Button>
    );
  }

  // Show connect/sign button using ConnectKit
  return (
    <ConnectKitButton.Custom>
      {({ isConnected: ckIsConnected, show, address }) => {
        // Show sign message button if connected but not authenticated
        if ((isConnected || ckIsConnected) && address) {
          return (
            <div className="w-full space-y-2">
              <Button
                onClick={handleSignMessage}
                disabled={isAuthenticating}
                className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc] disabled:opacity-50"
              >
                <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
                  {isAuthenticating ? "Signing Message..." : "Sign Message"}
                </span>
              </Button>
              {authError && (
                <p className="text-center text-sm text-red-400">
                  {authError}
                </p>
              )}
            </div>
          );
        }

        // Show connect wallet button
        return (
          <Button
            onClick={show}
            className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
          >
            <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
              Connect Wallet
            </span>
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
