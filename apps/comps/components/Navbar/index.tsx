// components/Navbar.tsx
"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";

import {Avatar, AvatarImage} from "@recallnet/ui2/components/avatar";

import {SIWEButton} from "../siwe";
import {Button} from "@/../../packages/ui2/src/components/shadcn/button";
import {Identicon} from "../Identicon";

// components/Navbar.tsx

export const Navbar: React.FunctionComponent = () => {
  const pathname = usePathname();
  const loggedIn = true
  const address = '0x40D12C464523Fc72Bdb31ce45Da2073b1174f802'

  const navItems = [
    {label: "COMPETITIONS", href: "/competitions"},
    {label: "LEADERBOARDS", href: "/leaderboards"},
  ];

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
                  className={`text-sm font-medium transition-colors ${isActive
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

      {
        loggedIn ?
          <div className="mx-3 flex items-center space-x-3">
            <span className="text-gray-400 text-sm font-medium">
              STAKED
            </span>
            <span className="text-white text-sm font-medium">
              700
            </span>
            <span className="text-gray-400 text-sm font-medium">
              WALLET
            </span>
            <span className="text-white text-sm font-medium">
              1000
            </span>
            <Button className="bg-black text-sky-700 hover:bg-sky-600 p-0">
              ADD FUNDS
            </Button>
            <Identicon address={address} />
            <span className="text-white text-sm font-medium">
              {address.slice(0, 6)}...{address.slice(-4)}
            </span>
          </div>
          :
          <div className="mx-3 flex items-center space-x-10">
            {/* Recall Network Text */}
            <span className="text-sm font-medium">
              RECALL.NETWORK
            </span>

            <SIWEButton className="bg-sky-700 px-6 py-5 text-white hover:bg-sky-600">
              JOIN / SIGN IN
            </SIWEButton>
          </div>
      }
    </nav>
  );
};
