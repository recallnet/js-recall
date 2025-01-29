"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAccount } from "wagmi";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recall/ui/components/dropdown-menu";
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
        <DropdownMenuContent className="ml-4">
          {isConnected && (
            <>
              <DropdownMenuItem onClick={() => router.push("/buckets")}>
                My Buckets
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/approvals")}>
                Approvals
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
              title="My Buckets"
              href="/buckets"
              active={pathname.startsWith("/buckets")}
            />
            <NavLink
              title="Approvals"
              href="/approvals"
              active={pathname.startsWith("/approvals")}
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
