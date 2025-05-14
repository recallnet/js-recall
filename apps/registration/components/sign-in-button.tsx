"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
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
  const { isAuthenticated, signIn, isLoading, error, isSigningIn } =
    useAuthContext();
  // No longer need local signing state as we use the one from auth context

  console.log("Button render state:", {
    isLoading,
    isSigningIn,
    isAuthenticated,
  });

  const handleSignIn = async () => {
    if (!isConnected) {
      // Open connect modal if not connected
      openConnectModal?.();
      return;
    }

    console.log("Starting sign-in from button");
    await signIn();
    console.log("Sign-in completed from button");
  };

  // Button is loading if either global loading state or signing state is true
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
