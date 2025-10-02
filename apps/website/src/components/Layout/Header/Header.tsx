import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { twMerge } from "tailwind-merge";

import { Symbol } from "@/components/Logo";
import { MenuItem as MenuItemType } from "@/types/components";

import { MenuIcon } from "./MenuIcon";
import { MenuItem } from "./MenuItem";

export const Header = ({ node }: { node: MenuItemType[] }) => {
  const headerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState<string | undefined>(undefined);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleOpen = (id: string) => {
    setIsOpen((prev) => (prev === id ? undefined : id));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        headerRef.current &&
        !headerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
        setIsOpen(undefined);
      }
    };

    document.addEventListener("click", handleClickOutside);

    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, []);

  const handleHide = () => {
    setIsMenuOpen(false);
    setIsOpen(undefined);
  };

  const ctaItem = node.find((item) => item._type === "CTA");
  const menuItems = node.filter((item) => item._type === "menuItem");

  return (
    <header className="fixed left-0 top-0 z-50 flex h-[55px] w-full items-center justify-center border-b border-[#212C3A]">
      <div className="absolute left-0 top-0 -z-10 h-full w-full bg-black/85 backdrop-blur-[22px]"></div>
      <div className="w-full max-w-[1136px]" ref={headerRef}>
        <div className="flex flex-row">
          <Symbol className="flex h-[55px] w-[55px] shrink-0 items-center justify-center border-l border-[#212C3A]" />
          <div
            className={twMerge(
              "flex grow flex-col max-lg:absolute max-lg:left-0 max-lg:top-full max-lg:mt-[1px] max-lg:w-full max-lg:bg-black/85 max-lg:backdrop-blur-[22px] lg:bottom-0 lg:flex-row",
              "max-lg:border-b max-lg:border-[#212C3A] max-lg:transition-all max-lg:duration-300",
              isMenuOpen
                ? "max-lg:opacity-1"
                : "max-lg:pointer-events-none max-lg:opacity-0",
            )}
          >
            {menuItems.map((item) => (
              <MenuItem
                key={item._key}
                item={item}
                isOpen={isOpen === item._key}
                handleOpen={handleOpen}
                handleHide={handleHide}
              />
            ))}
          </div>

          {ctaItem && (
            <div className="group relative w-[19%] max-lg:ml-auto max-lg:w-[180px]">
              <Link
                href={ctaItem?.href ?? "#"}
                className={twMerge(
                  "flex h-[55px] items-center justify-center text-center",
                  "bg-white text-[#1D1F2B] transition-all duration-300 hover:bg-[#0064C7] hover:text-[#CED2D4]",
                )}
              >
                <span className="font-secondary flex flex-row items-center gap-2 text-[12px] font-semibold uppercase tracking-[1.56px]">
                  {ctaItem.title}
                </span>
              </Link>
            </div>
          )}
          <button
            className="flex h-[55px] w-[55px] items-center justify-center border-l border-[#212C3A] lg:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            type="button"
          >
            <MenuIcon isActive={isMenuOpen} />
          </button>
        </div>
      </div>
    </header>
  );
};
