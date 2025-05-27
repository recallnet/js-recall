"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FaBars } from "react-icons/fa6";

import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/shadcn/button";
import { cn } from "@recallnet/ui2/lib/utils";

import { SIWEButton } from "@/components/siwe";

export const Navbar: React.FunctionComponent<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pathname = usePathname();
  const navItems = [
    { label: "COMPETITIONS", href: "/competitions" },
    { label: "LEADERBOARDS", href: "/leaderboards" },
  ];

  const isOnboarding = pathname === "/onboarding";
  const [open, setOpen] = useState(false);

  if (isOnboarding) return children;

  return (
    <>
      <nav className="flex w-full justify-center border-b border-gray-700 bg-black">
        <div className="xl:px-25 flex w-full items-center justify-between md:px-5 lg:px-20">
          <div className="flex items-center gap-4">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center border-x border-gray-700 p-1"
            >
              <Avatar className="h-12 w-12">
                <AvatarImage src="/favicon-32x32.png" alt="recallnet" />
              </Avatar>
            </Link>

            {/* Inline nav items for lg+ */}
            <div className="hidden lg:flex">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    className={cn(
                      "px-15 flex h-14 items-center justify-center border-r border-gray-700",
                      isActive ? "border-b-2 border-b-yellow-500" : "",
                    )}
                  >
                    <span
                      className={`text-xs font-medium text-white transition-colors`}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>

            {/* Dropdown trigger for <lg */}
            <div className="lg:hidden">
              <DropdownMenu.Root open={open} onOpenChange={setOpen}>
                <DropdownMenu.Trigger asChild>
                  <Button className="bg-transparent text-white hover:bg-transparent">
                    <FaBars />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    className="z-50 min-w-[180px] rounded-md border border-gray-700 bg-black p-1 shadow-xl"
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

          <div>
            <SIWEButton className="bg-sky-700 px-6 py-5 text-white hover:bg-sky-600">
              JOIN / SIGN IN
            </SIWEButton>
          </div>
        </div>
      </nav>

      <div className="xl:px-25 flex justify-center pt-10 md:px-5 lg:px-20">
        {children}
      </div>
    </>
  );
};
