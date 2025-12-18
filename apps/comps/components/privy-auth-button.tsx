"use client";

import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
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

  const { login, backendUser, isAuthenticated, isPending, logout, error } =
    useSession();

  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.invalidateQueries({
      queryKey: tanstackClient.user.getCompetitions.key(),
    });
    queryClient.invalidateQueries({
      queryKey: tanstackClient.competitions.list.key(),
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
    const displayName = backendUser.name ?? undefined;
    const walletAddress = backendUser.walletAddress;
    const avatarUrl = backendUser.imageUrl ?? undefined;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div
            className={cn(
              "flex cursor-pointer items-center justify-between rounded px-2 py-1 transition-colors",
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
                  bgClassName="bg-muted"
                  address={walletAddress || displayName || "User"}
                />
              </AvatarFallback>
            </Avatar>
            <div className="ml-3 hidden font-mono text-xs font-medium uppercase tracking-widest text-white md:block">
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
          <DropdownMenuItem onClick={() => router.push("/profile")}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout} disabled={isPending}>
            <LogOut className="text-secondary-foreground h-4 w-4" />
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
