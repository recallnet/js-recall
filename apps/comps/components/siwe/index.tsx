"use client";

import { ConnectKitButton } from "connectkit";
import { LogOut, Smartphone } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui2/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";

import { useLogout, useUserSession } from "@/hooks";
import { useSiweAuth } from "@/hooks/useSiweAuth";

import { Identicon } from "../identicon/index";

/**
 * SIWE Button component using ConnectKit
 * Handles the full authentication flow: connect wallet -> sign message -> authenticate
 */
export const SIWEButton: React.FunctionComponent = () => {
  const router = useRouter();
  const logout = useLogout();
  const session = useUserSession();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticate, isAuthenticating, authError } = useSiweAuth();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent;
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          userAgent,
        );
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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

  // Show authenticated state with dropdown
  if (user) {
    return (
      <div className="mx-3 flex items-center space-x-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="ml-5 flex cursor-pointer items-center justify-between">
              {user.imageUrl ? (
                <Image
                  src={user.imageUrl}
                  alt="agent"
                  className="pointer-events-none"
                  width={25}
                  height={25}
                />
              ) : (
                <Identicon
                  className="rounded-none"
                  address={user.walletAddress}
                />
              )}
              <div className="focus ml-3 text-xs font-medium text-white">
                {user.walletAddress.slice(0, 6)}...
                {user.walletAddress.slice(-4)}
              </div>
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => router.push("/profile")}
              className="cursor-pointer p-3 hover:bg-gray-800"
            >
              My Account
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer p-3 hover:bg-gray-800"
              disabled={logout.isPending}
            >
              <LogOut className="h-4 w-4 text-gray-600" />
              {logout.isPending ? "Logging Out..." : "Log-Out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Show connect/sign button using ConnectKit
  return (
    <ConnectKitButton.Custom>
      {({ isConnected: ckIsConnected, show, address }) => {
        // Consistent container for all button states
        return (
          <div className="flex flex-col items-center space-y-2">
            {/* Button - consistent positioning regardless of state */}
            {(isConnected || ckIsConnected) && address ? (
              <Button
                onClick={handleSignMessage}
                disabled={isAuthenticating}
                variant="ghost"
                className="h-full px-6"
              >
                {isAuthenticating ? "Signing..." : "Sign Message"}
              </Button>
            ) : (
              <Button onClick={show} variant="ghost" className="h-full px-6">
                JOIN / SIGN IN
              </Button>
            )}

            {/* Mobile help text when signing - only show when connected and authenticating */}
            {(isConnected || ckIsConnected) &&
              address &&
              isAuthenticating &&
              isMobile && (
                <div className="mx-auto max-w-sm rounded-lg border border-slate-700 bg-slate-800 p-4 shadow-lg">
                  <div className="flex items-start space-x-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
                      <Smartphone className="h-4 w-4 text-blue-400" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium text-blue-300">
                        Mobile Wallet Tip
                      </p>
                      <p className="text-sm leading-relaxed text-slate-300">
                        You may need to return to your wallet app to sign the
                        message, then come back here to continue.
                      </p>
                    </div>
                  </div>
                </div>
              )}

            {/* Error message - only show when connected and there's an error */}
            {(isConnected || ckIsConnected) && address && authError && (
              <p className="text-center text-sm text-red-400">{authError}</p>
            )}
          </div>
        );
      }}
    </ConnectKitButton.Custom>
  );
};
