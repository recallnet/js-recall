"use client";

import { useAccount } from "wagmi";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recall/ui/components/dropdown-menu";
import { Menu } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@recall/ui/lib/utils";

function NavLink({
  title,
  href,
  active,
}: {
  title: string;
  href: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        !active && "after:scale-x-0",
        "after:bg-primary relative block w-fit after:absolute after:block after:h-[1px] after:w-full after:origin-left after:transition after:duration-300 after:content-[''] after:hover:scale-x-100",
      )}
    >
      {title}
    </Link>
  );
}

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const { isConnected } = useAccount();

  return (
    <div className="flex items-center gap-6">
      <DropdownMenu>
        <DropdownMenuTrigger className="md:hidden">
          <Menu />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="ml-2">
          {isConnected && (
            <>
              <DropdownMenuItem onClick={() => router.push("/agents")}>
                My Agents
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push("/credit-delegations")}
              >
                Credit Delegations
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={() => router.push("/docs")}>
            Docs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="hidden gap-6 md:flex">
        {isConnected && (
          <>
            <NavLink
              title="My Agents"
              href="/agents"
              active={pathname.startsWith("/agents")}
            />
            <NavLink
              title="Credit Delegations"
              href="/credit-delegations"
              active={pathname.startsWith("/credit-delegations")}
            />
          </>
        )}
        <NavLink
          title="Docs"
          href="/docs"
          active={pathname.startsWith("/docs")}
        />
      </div>
    </div>
  );
}
