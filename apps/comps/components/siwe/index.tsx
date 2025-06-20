"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { LogOut } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/dropdown-menu";

import { useLogout, useUserSession } from "@/hooks";

import { Identicon } from "../identicon/index";

export const SIWEButton: React.FunctionComponent = () => {
  const router = useRouter();
  const logout = useLogout();
  const session = useUserSession();

  const handleLogout = async () => {
    logout.mutate();
  };

  if (!session.isInitialized) {
    return null;
  }

  const { user } = session;

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

  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => (
        <Button
          onClick={openConnectModal}
          variant="ghost"
          className="h-full px-6"
        >
          JOIN / SIGN IN
        </Button>
      )}
    </ConnectButton.Custom>
  );
};
