"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@recallnet/ui/lib/utils";

/**
 * Primary navigation component for the application
 *
 * @returns Navigation component with links to main pages
 */
export function Nav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "Home",
      href: "/",
      active: pathname === "/",
    },
    {
      name: "Account",
      href: "/account",
      active: pathname === "/account",
    },
    {
      name: "Registry",
      href: "/registry",
      active: pathname === "/registry",
    },
  ];

  return (
    <nav className="flex items-center space-x-6">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "hover:text-primary text-sm font-medium transition-colors",
            item.active
              ? "text-primary"
              : "text-muted-foreground hover:text-primary",
          )}
        >
          {item.name}
        </Link>
      ))}
    </nav>
  );
}
