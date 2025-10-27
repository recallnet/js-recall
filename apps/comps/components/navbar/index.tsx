"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";

import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { Claim } from "@/components/Claim";
import { ConnectWallet } from "@/components/connect-wallet";
import { PrivyAuthButton } from "@/components/privy-auth-button";
import { config } from "@/config/public";
import { useSession } from "@/hooks";
import { useClaim } from "@/hooks/useClaim";

import { NonStakeBoost } from "./NonStakeBoost";
import { RecallToken } from "./RecallToken";
import { StakeBoost } from "./StakeBoost";

export const Navbar: React.FunctionComponent = () => {
  const pathname = usePathname();

  const { isAuthenticated, isWalletConnected } = useSession();
  const { totalClaimable } = useClaim();

  const [open, setOpen] = useState(false);

  const navItems = useMemo(() => {
    return [
      { label: "COMPETITIONS", href: "/competitions", mobileOnly: false },
      { label: "LEADERBOARDS", href: "/leaderboards", mobileOnly: false },
      {
        label: "STAKE RECALL",
        href: "/stake",
        mobileOnly: isWalletConnected,
      },
    ];
  }, [isWalletConnected]);

  return (
    <nav className="flex w-full justify-center border-b bg-black px-5 sm:px-12">
      <div className="xs:pr-0 mx-auto flex w-full max-w-screen-2xl items-center justify-between">
        <div className="flex items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center border-x p-1">
            <Avatar className="h-12 w-12">
              <AvatarImage
                src="/logo_white.svg"
                alt="recallnet"
                className="p-2"
              />
            </Avatar>
          </Link>

          {/* Inline nav items for sm+ */}
          <div className="hidden sm:flex">
            {navItems
              .filter((item) => !item.mobileOnly)
              .map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    className={cn(
                      "px-15 radial-hover flex h-14 items-center justify-center border-r",
                      isActive ? "border-b-2 border-b-yellow-500" : "",
                    )}
                  >
                    <span
                      className={`font-mono text-xs font-medium tracking-widest text-white transition-colors`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
          </div>

          {/* Dropdown trigger for <sm */}
          <div className="sm:hidden">
            <DropdownMenu.Root open={open} onOpenChange={setOpen}>
              <DropdownMenu.Trigger asChild>
                <Button className="bg-transparent text-white hover:bg-transparent">
                  <Menu />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="z-50 min-w-[180px] rounded-md border bg-black p-1 shadow-xl"
                  sideOffset={5}
                >
                  {navItems.map((item) => (
                    <DropdownMenu.Item
                      key={item.href}
                      asChild
                      onSelect={() => setOpen(false)}
                    >
                      <Link
                        href={item.href}
                        className="block px-4 py-2 text-sm text-gray-300"
                      >
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>

        <div className="flex h-full items-center gap-4">
          {isAuthenticated && isWalletConnected && (
            <div className="hidden h-full items-center gap-4 sm:flex">
              <div
                className={cn(
                  "flex h-full items-center",
                  pathname === "/stake" ? "shadow-[0_2px_0_0_#eab308]" : "",
                )}
              >
                {config.publicFlags.tge && <RecallToken />}
              </div>
              {config.publicFlags.tge ? <StakeBoost /> : <NonStakeBoost />}
              {/* <GetRecall /> */}
              {/* <StakeRecall /> */}
              {totalClaimable > 0n && <Claim />}
            </div>
          )}
          {isAuthenticated && !isWalletConnected && (
            <div className="flex h-full items-center">
              <ConnectWallet />
            </div>
          )}
          <div
            className={cn(
              "flex h-full items-center",
              pathname === "/profile" ? "shadow-[0_2px_0_0_#eab308]" : "",
            )}
          >
            <PrivyAuthButton />
          </div>
        </div>
      </div>
    </nav>
  );
};
