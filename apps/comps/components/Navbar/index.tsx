// components/Navbar.tsx
"use client";

import { useAtom } from "jotai";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui2/components/shadcn/dropdown-menu";

import { userAtom } from "../../state/atoms";
import { Identicon } from "../Identicon";
import { SIWEButton } from "../siwe";

// components/Navbar.tsx

// components/Navbar.tsx

// components/Navbar.tsx

// components/Navbar.tsx

export const Navbar: React.FunctionComponent = () => {
  const pathname = usePathname();
  const [user, setUser] = useAtom(userAtom);

  const navItems = [
    { label: "COMPETITIONS", href: "/competitions" },
    { label: "LEADERBOARDS", href: "/leaderboards" },
  ];

  const handleLogout = () => {
    setUser({ loggedIn: false, address: "" });
  };

  return (
    <nav className="flex w-full items-center justify-between bg-black p-5">
      <div className="flex items-center space-x-8">
        <Link href="/" className="flex items-center">
          <Avatar className="h-12 w-12">
            {" "}
            <AvatarImage
              src="/favicon-32x32.png"
              alt="recallnet"
              className="w-12"
            />
          </Avatar>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center space-x-6">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <span
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? "text-white underline underline-offset-4"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {user.loggedIn ? (
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

          <SIWEButton className="bg-sky-700 px-6 py-5 text-white hover:bg-sky-600">
            JOIN / SIGN IN
          </SIWEButton>
        </div>
      )}
    </nav>
  );
};
