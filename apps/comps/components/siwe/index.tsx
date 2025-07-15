"use client";

import { ConnectKitButton } from "connectkit";
import { LogOut, Smartphone } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui2/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";
import { toast } from "@recallnet/ui2/components/toast";

import { Identicon } from "@/components/identicon/index";
import { useLogout, useSiweAuth, useUserSession } from "@/hooks";

/**
 * SignIn button component using ConnectKit
 * Handles the full authentication flow: connect wallet -> sign message -> authenticate
 */
export function SignInButton() {
  const logout = useLogout();
  const session = useUserSession();
  const router = useRouter();

  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { authenticate, isAuthenticating, authError, clearError } =
    useSiweAuth();

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const buttonClasses = "h-full px-6 text-black uppercase";

  const handleLogout = useCallback(async () => {
    try {
      await logout.mutateAsync();
      disconnect();
    } catch (error) {
      console.error("Logout failed:", error);
      disconnect();
    }
  }, [disconnect, logout]);

  const handleSignMessage = async () => {
    try {
      await authenticate();
    } catch (error) {
      console.error("Manual authentication failed:", error);
    }
  };

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

  useEffect(() => {
    if (authError) {
      toast.error(authError);
      handleLogout();
      clearError();
    }
  }, [authError, handleLogout, clearError]);

  if (!session.isInitialized) {
    return null;
  }

  const user = session?.user;

  // Show authenticated state with logout (both session and wallet)
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
          <DropdownMenuContent className="w-40 rounded-lg bg-black">
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
            >
              <LogOut className="h-10 w-10 text-gray-600" />
              Log-Out
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
        if ((isConnected || ckIsConnected) && address) {
          return (
            <>
              <Button
                onClick={handleSignMessage}
                disabled={isAuthenticating}
                variant="ghost"
                className={buttonClasses}
              >
                {isAuthenticating ? "Signing Message..." : "Sign Message"}
              </Button>

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
            </>
          );
        }

        return (
          <Button onClick={show} className={buttonClasses} variant="ghost">
            Connect Wallet
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}
