"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useRef, useState } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";
import { toast } from "@recallnet/ui2/components/toast";

import { useLogout, useUserSession } from "@/hooks";
import { usePrivyAuth } from "@/hooks/usePrivyAuth";

import { Identicon } from "./identicon/index";

/**
 * Privy Authentication Button component
 * Replaces the SIWE button with Privy authentication
 */
export const PrivyAuthButton: React.FunctionComponent = () => {
  const router = useRouter();
  const session = useUserSession();
  const { ready, login, logout, isAuthenticating, authError, clearError } =
    usePrivyAuth();
  const { mutateAsync: logoutBackend } = useLogout();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    setIsLoggingOut(false);
  }, [logout]);

  // Track error display to avoid multiple toasts
  const errorDisplayedRef = useRef<string | null>(null);

  // Handle error display separately to avoid multiple toasts
  useEffect(() => {
    if (authError && authError !== errorDisplayedRef.current) {
      errorDisplayedRef.current = authError;
      toast.error(authError);
    }
    if (!authError) {
      errorDisplayedRef.current = null;
    }
  }, [authError]);

  const handleLogin = async () => {
    clearError();
    try {
      login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logoutBackend();
      setIsLoggingOut(true);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (!ready) {
    return null;
  }

  if (!session.isInitialized) {
    return null;
  }

  const { user } = session;

  // Show authenticated state with dropdown
  if (user && session.isInitialized && session.isAuthenticated) {
    const displayName = user.name;
    const walletAddress = user.walletAddress;
    const avatarUrl = user.imageUrl;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="ml-5 flex cursor-pointer items-center justify-between">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={avatarUrl}
                alt="avatar"
                className="object-cover"
              />
              <AvatarFallback className="text-xs">
                <Identicon
                  className="rounded-none"
                  address={walletAddress || displayName || "User"}
                  size={24}
                />
              </AvatarFallback>
            </Avatar>
            <div className="focus ml-3 text-xs font-medium text-white">
              {displayName ||
                walletAddress?.slice(0, 6) + "..." + walletAddress?.slice(-4) ||
                "User"}
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
            disabled={isLoggingOut}
          >
            <LogOut className="h-4 w-4 text-gray-600" />
            {isLoggingOut ? "Logging Out..." : "Log-Out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Show login button for unauthenticated users
  return (
    <div className="flex flex-col items-center space-y-2">
      <Button
        onClick={handleLogin}
        disabled={isAuthenticating}
        variant="ghost"
        className="h-14 rounded-none px-6 uppercase"
      >
        {isAuthenticating ? "Connecting..." : "Join / Sign In"}
      </Button>
    </div>
  );
};
