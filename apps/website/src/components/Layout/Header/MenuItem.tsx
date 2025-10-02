import Link from "next/link";
import { twMerge } from "tailwind-merge";

import { DropdownIcon } from "./DropdownIcon";

type MenuItem = {
  title: string;
  href?: string;
  submenu?: {
    title: string;
    href: string;
  }[];
  _key: string;
};

const itemTheme = `flex items-center lg:justify-center text-[#D9D9D9] h-[45px] lg:h-[55px] lg:text-center border-l border-[#212C3A] max-lg:px-3 lg:group-hover:bg-[rgba(199,_208,_225,_0.1)]`;

export const MenuItem = ({
  item,
  isOpen,
  handleOpen,
  handleHide,
}: {
  item: MenuItem;
  isOpen: boolean;
  handleOpen: (_key: string) => void;
  handleHide: () => void;
}) => {
  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (item.submenu) {
      e.preventDefault();
      handleOpen(item._key);

      return;
    }

    handleHide();
  };

  return (
    <div className="group relative lg:w-[25%] lg:grow" key={item.title}>
      <Link
        href={item?.href ?? "#"}
        className={twMerge(itemTheme)}
        onClick={onClick}
        target={item.submenu ? undefined : "_blank"}
      >
        <span
          className={twMerge(
            "font-secondary flex flex-row gap-2 text-[12px] font-semibold uppercase tracking-[1.56px] lg:items-center",
            item.submenu && "max-lg:text-gray",
          )}
        >
          {item.title}{" "}
          {item.submenu && (
            <span className="max-lg:hidden">
              <DropdownIcon />
            </span>
          )}
        </span>
      </Link>
      {item.submenu && (
        <div
          className={twMerge(
            "w-full lg:absolute lg:left-0 lg:top-full lg:border lg:border-t-0 lg:border-[#212C3A] lg:bg-black/85 lg:backdrop-blur-[22px]",
            isOpen ? "lg:block" : "lg:hidden",
          )}
        >
          <div className="flex flex-col">
            {item.submenu.map((subItem) => (
              <Link
                key={subItem.title}
                href={subItem.href}
                className="flex h-[45px] items-center text-[#D9D9D9] hover:bg-[rgba(199,_208,_225,_0.1)] max-lg:px-3 lg:justify-center lg:text-center"
                onClick={handleHide}
                target="_blank"
              >
                <span className="font-secondary text-[12px] font-semibold uppercase tracking-[1.56px]">
                  {subItem.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
