"use client";

import { Loader2, LogOut, User, UserCircle } from "lucide-react";
import Link from "next/link";
import { useAccount, useDisconnect } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recallnet/ui/components/shadcn/dropdown-menu";

import { useAuthContext } from "@/components/auth-provider";
import { SignInButton } from "@/components/sign-in-button";
import { shortenAddress } from "@/lib/utils";

/**
 * User menu component
 *
 * Shows user information and authentication options
 */
export function UserMenu() {
  const { disconnect } = useDisconnect();
  const { address } = useAccount();
  const { isAuthenticated, wallet, isAdmin, logout, isLoading } =
    useAuthContext();

  if (!address) {
    return <SignInButton />;
  }

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  if (!isAuthenticated) {
    return <SignInButton />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <UserCircle className="h-4 w-4" />
          {shortenAddress(wallet || address || "")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link
            href="/account"
            className="flex cursor-pointer items-center gap-2"
          >
            <User className="h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>

        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link
              href="/admin"
              className="flex cursor-pointer items-center gap-2"
            >
              <User className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive flex cursor-pointer items-center gap-2"
          onClick={async () => {
            await logout();
            disconnect();
          }}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
