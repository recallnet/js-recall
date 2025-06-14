"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useState} from "react";
import {FaBars} from "react-icons/fa6";

import {Avatar, AvatarImage} from "@recallnet/ui2/components/avatar";
import {Button} from "@recallnet/ui2/components/button";
import {cn} from "@recallnet/ui2/lib/utils";

import {SIWEButton} from "@/components/siwe";

const ACTIVE_BORDER_STYLE = "border-b-2 border-b-yellow-500";

export const Navbar: React.FunctionComponent<{children: React.ReactNode}> = ({
  children,
}) => {
  const pathname = usePathname();
  const navItems = [
    {label: "COMPETITIONS", href: "/competitions"},
    {label: "LEADERBOARDS", href: "/leaderboards"},
  ];

  const isOnboarding = pathname === "/onboarding";
  const [open, setOpen] = useState(false);

  if (isOnboarding) return children;

  return (
    <>
      <nav className="flex w-full justify-center border-b bg-black">
        <div className="mx-auto flex w-full max-w-screen-lg items-center justify-between px-10 sm:px-20">
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

            {/* Inline nav items for lg+ */}
            <div className="xs:flex hidden">
              {navItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    href={item.href}
                    key={item.href}
                    className={cn(
                      "px-15 flex h-14 items-center justify-center border-r",
                      isActive ? ACTIVE_BORDER_STYLE : "",
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
            <div className="xs:hidden">
              <DropdownMenu.Root open={open} onOpenChange={setOpen}>
                <DropdownMenu.Trigger asChild>
                  <Button className="bg-transparent text-white hover:bg-transparent">
                    <FaBars />
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

          <div
            className={cn("flex h-full items-center", {
              [ACTIVE_BORDER_STYLE]: pathname === "/profile",
            })}
          >
            <SIWEButton>JOIN / SIGN IN</SIWEButton>
          </div>
        </div>
      </nav>

      <div className="mx-auto flex w-full max-w-screen-lg justify-center px-5 pt-10 sm:px-20">
        {children}
      </div>
    </>
  );
};
