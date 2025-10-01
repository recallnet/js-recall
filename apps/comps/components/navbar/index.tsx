"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Menu, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { attoValueToNumberValue } from "@recallnet/conversions/atto-conversions";
import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/button";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { PrivyAuthButton } from "@/components/privy-auth-button";
import { useSession } from "@/hooks";

const nonStakeBoostAmount = process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT
  ? BigInt(process.env.NEXT_PUBLIC_NON_STAKE_BOOST_AMOUNT)
  : undefined;

const formattedNumber = new Intl.NumberFormat();

export const Navbar: React.FunctionComponent = () => {
  const pathname = usePathname();
  const navItems = [
    { label: "COMPETITIONS", href: "/competitions" },
    { label: "LEADERBOARDS", href: "/leaderboards" },
  ];

  const { isAuthenticated } = useSession();

  const [open, setOpen] = useState(false);

  return (
    <nav className="flex w-full justify-center border-b bg-black">
      <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between px-5 sm:px-20">
        <div className="flex items-center">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center border-x p-1 transition-colors hover:bg-white/5"
          >
            <Avatar className="h-12 w-12">
              <AvatarImage
                src="/logo_white.svg"
                alt="recallnet"
                className="p-2"
              />
            </Avatar>
          </Link>

          {/* Inline nav items for lg+ */}
          <div className="xs:flex hidden">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  href={item.href}
                  key={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "px-15 group relative flex h-14 items-center justify-center border-r transition-colors hover:bg-white/5",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-xs font-medium tracking-widest text-white",
                    )}
                  >
                    {item.label}
                  </span>
                  {/* underline */}
                  <span
                    className={cn(
                      "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center transform bg-[var(--color-yellow-500)] transition-transform duration-300 motion-reduce:transition-none",
                      isActive
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                  {/* glow */}
                  <span
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute -bottom-[1px] left-1/2 h-5 w-44 -translate-x-1/2 transform bg-[radial-gradient(ellipse_at_center,rgba(249,183,0,0.55)_0%,rgba(249,183,0,0.35)_45%,rgba(249,183,0,0)_70%)] blur-[1px] transition-opacity duration-300",
                      isActive
                        ? "opacity-80"
                        : "opacity-0 group-hover:opacity-70",
                    )}
                  />
                </Link>
              );
            })}
          </div>

          {/* Dropdown trigger for <sm */}
          <div className="xs:hidden">
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

        <div className="flex h-full flex-row items-center space-x-8">
          {isAuthenticated && nonStakeBoostAmount && (
            <Tooltip
              tooltipClassName="max-w-xs"
              content="Boost available per competition. Visit any active compeition page to activate yours and start boosting agents."
            >
              <div className="flex flex-row items-center space-x-2 font-bold text-yellow-500">
                <Zap className="size-4" />
                <span>
                  {formattedNumber.format(
                    attoValueToNumberValue(nonStakeBoostAmount),
                  )}
                </span>
              </div>
            </Tooltip>
          )}
          <div className={cn("group relative flex h-14 items-center")}>
            <PrivyAuthButton />
            {/* underline */}
            <span
              className={cn(
                "pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-center transform bg-[var(--color-yellow-500)] transition-transform duration-300 motion-reduce:transition-none",
                pathname === "/profile"
                  ? "scale-x-100"
                  : "scale-x-0 group-hover:scale-x-100",
              )}
            />
            {/* glow */}
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -bottom-[1px] left-1/2 h-5 w-44 -translate-x-1/2 transform bg-[radial-gradient(ellipse_at_center,rgba(249,183,0,0.55)_0%,rgba(249,183,0,0.35)_45%,rgba(249,183,0,0)_70%)] blur-[1px] transition-opacity duration-300",
                pathname === "/profile"
                  ? "opacity-80"
                  : "opacity-0 group-hover:opacity-70",
              )}
            />
          </div>
        </div>
      </div>
    </nav>
  );
};
