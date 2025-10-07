"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect } from "react";

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
import { cn } from "@recallnet/ui2/lib/utils";

import { useSession } from "@/hooks/useSession";
import { tanstackClient } from "@/rpc/clients/tanstack-query";

import { Identicon } from "./identicon/index";

/**
 * Privy Authentication Button component
 */
export const PrivyAuthButton: React.FunctionComponent = () => {
  const router = useRouter();
  const pathname = usePathname();

  const { login, backendUser, isAuthenticated, isPending, logout, error } =
    useSession();

  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({
      queryKey: tanstackClient.user.getCompetitions.key(),
    });
    queryClient.invalidateQueries({
      queryKey: tanstackClient.competitions.listEnriched.key(),
    });
    queryClient.invalidateQueries({
      queryKey: tanstackClient.competitions.getById.key(),
    });
  }, [isAuthenticated, queryClient]);

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
  }, [error]);

  const handleLogin = async () => {
    try {
      login();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Show authenticated state with dropdown
  if (backendUser && isAuthenticated) {
    const displayName = backendUser.name;
    const walletAddress = backendUser.walletAddress;
    const avatarUrl = backendUser.imageUrl;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded px-2 py-1 transition-colors",
              pathname !== "/profile" && "hover:bg-gray-900/50",
            )}
          >
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
            disabled={isPending}
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
      disabled={isPending}
      variant="ghost"
      className={cn(
        "h-14 rounded-none px-6 uppercase",
        isPending && "animate-pulse bg-white/40",
      )}
    >
      Join / Sign In
    </Button>
  );
};
