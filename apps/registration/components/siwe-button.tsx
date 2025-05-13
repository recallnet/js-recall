"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAtom } from "jotai";
import React from "react";
import { useAccount, useDisconnect } from "wagmi";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui/components/shadcn/dropdown-menu";
import { cn } from "@recallnet/ui/lib/utils";

import { userAtom } from "@/state/atoms";

/**
 * Identicon component props
 */
type IdenticonProps = {
  /**
   * Ethereum address to generate identicon for
   */
  address: string;
};

/**
 * Simple identicon component that shows a colorful circle based on the address
 */
const Identicon: React.FC<IdenticonProps> = ({ address }) => {
  // Generate a color based on the address
  const color = `#${address.slice(2, 8)}`;

  return (
    <div className="h-6 w-6 rounded-full" style={{ backgroundColor: color }} />
  );
};

/**
 * Sign-In with Ethereum button component props
 */
type SIWEButtonProps = React.HTMLAttributes<HTMLDivElement>;

/**
 * Sign-In with Ethereum button component
 *
 * Provides wallet connection and user authentication functionality
 */
export const SIWEButton: React.FC<SIWEButtonProps> = ({
  className,
  ...props
}) => {
  const [user, setUser] = useAtom(userAtom);
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  const handleLogout = async () => {
    // Disconnect the wallet
    await disconnect();
    // Reset the user state
    setUser({ loggedIn: false, address: "" });
  };

  // Update user state when account changes
  React.useEffect(() => {
    if (isConnected && address && !user.loggedIn) {
      setUser({
        loggedIn: true,
        address: address,
      });
    } else if (!isConnected && user.loggedIn) {
      setUser({ loggedIn: false, address: "" });
    }
  }, [isConnected, address, user.loggedIn, setUser]);

  return (
    <ConnectButton.Custom>
      {({ openConnectModal }) => {
        return user.loggedIn ? (
          <div
            className={cn("flex items-center space-x-3", className)}
            {...props}
          >
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <div className="flex cursor-pointer items-center justify-between">
                  <Identicon address={user.address} />
                  <div className="ml-3 text-sm font-medium">
                    {displayAddress(user.address)}
                  </div>
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-background">
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="hover:bg-muted cursor-pointer"
                >
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className={className} {...props}>
            <Button onClick={openConnectModal} className="px-4 py-2">
              Connect Wallet
            </Button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};
