"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useAuthContext } from "@/components/auth-provider";
import { logout } from "@/lib/auth";

/**
 * SignIn button component
 *
 * Handles the sign-in flow with the wallet
 */
export function SignInButton() {
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

  const { isConnected } = useAccount();
  const { isAuthenticated, isLoading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    try {
      setIsSigningIn(true);
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isAuthenticated) {
    return (
      <Button
        variant="outline"
        onClick={async () => {
          await logout();
          disconnect();
        }}
        className="w-full rounded-none border border-[#303846] bg-transparent py-5 transition-colors hover:bg-[#0e1218]"
      >
        <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#596E89]">
          Log Out
        </span>
      </Button>
    );
  }

  const isButtonLoading = isLoading || isSigningIn;

  return (
    <div className="space-y-2">
      <Button
        onClick={handleSignIn}
        disabled={isButtonLoading}
        className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc]"
      >
        {isButtonLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isConnected ? "Signing In..." : "Connecting..."}
          </>
        ) : isConnected ? (
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Sign In
          </span>
        ) : (
          <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
            Connect Wallet
          </span>
        )}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
