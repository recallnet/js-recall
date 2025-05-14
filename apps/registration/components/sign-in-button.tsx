"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Loader2 } from "lucide-react";
import { CSSProperties } from "react";
import { useAccount } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useAuthContext } from "@/components/auth-provider";

/**
 * SignIn button component
 *
 * Handles the sign-in flow with the wallet
 */
export function SignInButton({ className = "", useCustomStyling = false }) {
  const { openConnectModal } = useConnectModal();
  const { isConnected } = useAccount();
  const { isAuthenticated, signIn, isLoading, error, isSigningIn } =
    useAuthContext();
  // No longer need local signing state as we use the one from auth context

  console.log("Button render state:", {
    isLoading,
    isSigningIn,
    isAuthenticated,
    error,
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

  // Custom styling option for the homepage
  const customButtonStyle: CSSProperties = useCustomStyling
    ? {
        width: "100%",
        padding: "1.25rem 0",
        backgroundColor: "#0057AD",
        borderRadius: "0",
        fontSize: "0.875rem",
        fontFamily: "'Trim Mono', monospace",
        fontWeight: 600,
        textTransform: "uppercase" as const,
        letterSpacing: "0.1em",
      }
    : {};

  const customButtonClass = useCustomStyling
    ? "w-full py-5 bg-[#0057AD] hover:bg-[#0066cc] transition-colors rounded-none text-sm font-semibold uppercase tracking-wider"
    : "";

  const customErrorClass = useCustomStyling
    ? "text-center text-red-500 text-sm mt-2 font-['Trim_Mono',monospace]"
    : "text-destructive text-sm";

  return (
    <div
      className={`${useCustomStyling ? "w-full" : "space-y-2"} ${className}`}
    >
      <Button
        onClick={handleSignIn}
        disabled={isButtonLoading}
        className={customButtonClass}
        style={customButtonStyle}
      >
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

      {error && <p className={customErrorClass}>{error}</p>}
    </div>
  );
}
