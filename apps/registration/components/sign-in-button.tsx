"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useAuthState } from "@/hooks/auth-state";

/**
 * SignIn button component
 *
 * Handles the sign-in flow with the wallet
 * Uses RainbowKit SIWE + NextAuth for authentication
 */
export function SignInButton() {
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  const {
    isAuthenticated,
    isLoading,
    isConnected,
    address,
    triggerSignIn,
    logout,
  } = useAuthState();
  const { status } = useSession();

  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  useEffect(() => {
    // If the user is authenticated, we can show the address
  }, [status]);

  const handleConnect = () => {
    // If already connected but not authenticated, trigger SIWE
    if (isConnected && !isAuthenticated) {
      handleSignIn();
    } else {
      // Otherwise open connect modal which will trigger SIWE automatically
      openConnectModal?.();
    }
  };

  const handleSignIn = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    try {
      setIsSigningIn(true);
      await triggerSignIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      setIsSigningOut(true);
      await logout();
      disconnect();
    } finally {
      setIsSigningOut(false);
    }
  };

  // Show the authenticated state
  if (isAuthenticated) {
    return (
      <Button
        variant="outline"
        onClick={handleLogout}
        disabled={isSigningOut}
        className="w-full rounded-none border border-[#303846] bg-transparent py-5 transition-colors hover:bg-[#0e1218]"
      >
        {isSigningOut ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Logging Out...
          </>
        ) : (
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89]">
            Log Out {address ? `(${address.substring(0, 6)}...)` : ""}
          </span>
        )}
      </Button>
    );
  }

  // Loading state - next-auth is checking auth status
  const buttonLoading = isLoading || isSigningIn;

  // Connect or sign in button based on wallet connection state
  return (
    <div className="space-y-2">
      <Button
        onClick={handleConnect}
        disabled={buttonLoading}
        className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
      >
        {buttonLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isSigningIn ? "Signing In..." : "Loading..."}
          </>
        ) : isConnected ? (
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Sign In with Wallet
          </span>
        ) : (
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Connect Wallet
          </span>
        )}
      </Button>
    </div>
  );
}
