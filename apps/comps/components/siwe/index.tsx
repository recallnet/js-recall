"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import { FaArrowRightFromBracket } from "react-icons/fa6";

import { Button } from "@recallnet/ui2/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/shadcn/dropdown-menu";

import { useLogout } from "@/hooks";
import { useProfile } from "@/hooks/useProfile";

export const SIWEButton: React.FunctionComponent<
  React.ComponentProps<typeof Button>
> = () => {
  const router = useRouter();
  const logout = useLogout();
  const { data: user, isError, refetch } = useProfile();

  const handleLogout = async () => {
    logout.mutate();
    await refetch();
  };

  const handleMyAccount = () => {
    router.push("/user/agents");
  };

  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => {
        return user && !isError ? (
          <div className="mx-3 flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="ml-5 flex cursor-pointer items-center justify-between">
                  <Image
                    src={user?.image}
                    alt="agent"
                    className="pointer-events-none"
                    width={25}
                    height={25}
                  />
                  <div className="focus ml-3 text-xs font-medium text-white">
                    {user.address.slice(0, 6)}...{user.address.slice(-4)}
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40 bg-black">
                <DropdownMenuItem
                  onClick={handleMyAccount}
                  className="cursor-pointer hover:bg-gray-800"
                >
                  My Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer hover:bg-gray-800"
                >
                  <FaArrowRightFromBracket className="h-10 w-10 text-gray-600" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="mx-3 flex items-center space-x-10">
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
