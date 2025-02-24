"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { HTMLAttributeAnchorTarget } from "react";
import { useAccount } from "wagmi";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui/components/dropdown-menu";
import { cn } from "@recallnet/ui/lib/utils";

function NavLink({
  title,
  href,
  target,
  active,
}: {
  title: string;
  href: string;
  target?: HTMLAttributeAnchorTarget;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      target={target}
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
        <DropdownMenuContent className="ml-4">
          {isConnected && (
            <>
              <DropdownMenuItem onClick={() => router.push("/buckets")}>
                Buckets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/account")}>
                Account
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            onClick={() => window.open("https://docs.recall.network", "_blank")}
          >
            Docs
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <div className="hidden gap-6 md:flex">
        {isConnected && (
          <>
            <NavLink
              title="Buckets"
              href="/buckets"
              active={pathname.startsWith("/buckets")}
            />
            <NavLink
              title="Account"
              href="/account"
              active={pathname.startsWith("/account")}
            />
          </>
        )}
        <NavLink
          title="Docs"
          href="https://docs.recall.network"
          target="_blank"
          active={pathname.startsWith("/docs")}
        />
      </div>
    </div>
  );
}
