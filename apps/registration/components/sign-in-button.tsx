"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAccount } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useAuthContext } from "@/components/auth-provider";

/**
 * SignIn button component
 *
 * Handles the sign-in flow with the wallet
 */
export function SignInButton() {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const { isAuthenticated, signIn, isLoading, error } = useAuthContext();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }

    try {
      setIsSigningIn(true);
      await signIn();
    } finally {
      setIsSigningIn(false);
    }
  };

  if (isAuthenticated) {
    return (
      <Button variant="outline" disabled>
        Signed In
      </Button>
    );
  }

  const isButtonLoading = isLoading || isSigningIn;

  return (
    <div className="space-y-2">
      <Button onClick={handleSignIn} disabled={isButtonLoading}>
        {isButtonLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isConnected ? "Signing In..." : "Connecting..."}
          </>
        ) : isConnected ? (
          "Sign In"
        ) : (
          "Connect Wallet"
        )}
      </Button>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
