// components/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarImage } from "@recallnet/ui2/components/avatar";

import { SIWEButton } from "../siwe";

// components/Navbar.tsx

export const Navbar: React.FunctionComponent = () => {
  const pathname = usePathname();

  const navItems = [
    { label: "COMPETITIONS", href: "/competitions" },
    { label: "LEADERBOARDS", href: "/leaderboards" },
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

      <div className="mx-3 flex items-center space-x-10">
        {/* Recall Network Text */}
        <span className="text-sm font-medium" style={{ color: "#596E89" }}>
          RECALL.NETWORK
        </span>

        <SIWEButton className="bg-sky-700 px-6 py-5 text-white hover:bg-sky-600">
          JOIN / SIGN IN
        </SIWEButton>
      </div>
    </nav>
  );
};
