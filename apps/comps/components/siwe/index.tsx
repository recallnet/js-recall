"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAtom } from "jotai";
import React from "react";

import { Button } from "@recallnet/ui2/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/shadcn/dropdown-menu";

import { userAtom } from "@/state/atoms";

import { Identicon } from "../Identicon";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = () => {
  const [user, setUser] = useAtom(userAtom);

  const handleLogout = () => {
    setUser({ loggedIn: false, address: "" });
  };

  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => {
        return user.loggedIn ? (
          <div className="mx-3 flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-400">STAKED</span>
            <span className="text-sm font-medium text-white">700</span>
            <span className="text-sm font-medium text-gray-400">WALLET</span>
            <span className="text-sm font-medium text-white">1000</span>
            <Button className="bg-black p-0 text-sky-700 hover:text-sky-600">
              ADD FUNDS
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="ml-5 flex cursor-pointer items-center justify-between">
                  <Identicon address={user.address} />
                  <div className="focus ml-3 text-sm font-medium text-white">
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer hover:bg-gray-800"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="mx-3 flex items-center space-x-10">
            {/* Recall Network Text */}
            <span className="text-sm font-medium">RECALL.NETWORK</span>

            <Button
              onClick={openConnectModal}
              className="bg-sky-700 px-6 py-5 text-white hover:bg-sky-600"
            >
              JOIN / SIGN IN
            </Button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
