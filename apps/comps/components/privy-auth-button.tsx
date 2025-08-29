"use client";

import { useAtom } from "jotai";
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
import { userAtom } from "@/state/atoms";

import { Identicon } from "./identicon/index";

/**
 * Privy Authentication Button component
 */
export const PrivyAuthButton: React.FunctionComponent = () => {
  const router = useRouter();
  const session = useUserSession();
  const [authState] = useAtom(userAtom); // Direct atom access to ensure re-renders
  const { ready, login, logout, isAuthenticating, authError, clearError } =
    usePrivyAuth();
  const { mutateAsync: logoutBackend } = useLogout();

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsLoggingOut(false);
  }, [logout]);

  // Set mounted state after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Force re-render when authentication state changes
  useEffect(() => {
    // This effect will run whenever session or auth state changes
    // The dependency on both ensures the component re-renders when auth changes
  }, [session, authState]);

  // Always check the auth atom first for the most up-to-date state
  const isAuthenticated =
    authState.status === "authenticated" && authState.user;
  const user = authState.user || (session.isInitialized ? session.user : null);

  // Show loading state until mounted to prevent hydration mismatch
  if (!mounted || (!ready && !isAuthenticated)) {
    return (
      <div className="h-14 w-[140px] animate-pulse rounded-none bg-white/10" />
    );
  }

  // Show authenticated state with dropdown
  if (user && isAuthenticated) {
    const displayName = user.name;
    const walletAddress = user.walletAddress;
    const avatarUrl = user.imageUrl;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="ml-5 flex cursor-pointer items-center justify-between">
            <Avatar className="h-10 w-10">
              <AvatarImage
                src={avatarUrl}
                alt="avatar"
                className="object-cover"
              />
              <AvatarFallback className="text-xs">
                <Identicon
                  className="rounded-none"
                  address={walletAddress || displayName || "User"}
                />
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 hidden text-xs font-medium uppercase text-white sm:block">
              {displayName && displayName.length > 15
                ? displayName.slice(0, 15) + "..."
                : displayName ||
                  walletAddress?.slice(0, 6) +
                    "..." +
                    walletAddress?.slice(-4) ||
                  "Account"}
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
            Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Show login button for unauthenticated users
  return (
    <Button
      onClick={handleLogin}
      disabled={isAuthenticating}
      variant="ghost"
      className="h-14 rounded-none px-6 uppercase"
    >
      Join / Sign In
    </Button>
  );
};
