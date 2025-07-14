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
        // Show sign message button if connected but not authenticated
        if ((isConnected || ckIsConnected) && address) {
          return (
            <div className="space-y-2">
              <Button
                onClick={handleSignMessage}
                disabled={isAuthenticating}
                variant="ghost"
                className="h-full px-6"
              >
                {isAuthenticating ? "Signing..." : "Sign Message"}
              </Button>

              {/* Mobile help text when signing */}
              {isAuthenticating && isMobile && (
                <div className="rounded border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start space-x-2">
                    <Smartphone className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Mobile tip:</span> You may
                      need to manually return to your wallet app to sign the
                      message, then come back to this page.
                    </p>
                  </div>
                </div>
              )}

              {authError && (
                <p className="text-center text-sm text-red-400">{authError}</p>
              )}
            </div>
          );
        }

        // Show connect button if not connected
        return (
          <Button onClick={show} variant="ghost" className="h-full px-6">
            JOIN / SIGN IN
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
};
