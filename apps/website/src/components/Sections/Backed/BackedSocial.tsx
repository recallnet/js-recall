import { twMerge } from "tailwind-merge";

import { LINKS } from "@/constants";
import { SocialType } from "@/types/components";

import { IconDiscord, IconDocs, IconX, IconYouTube } from "./components";

const Item = ({
  className,
  title,
  icon,
  href,
}: {
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  href?: string;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className={twMerge(
      "clip-path-small-polygon flex h-[164px] grow flex-col items-start justify-end",
      "group max-lg:min-w-[164px] max-lg:shrink-0",
      className,
    )}
  >
    <div className="mb-auto pl-[30px] pt-[28px] opacity-75 transition-opacity duration-300 group-hover:opacity-100">
      {icon}
    </div>

    <div className="flex w-full flex-row items-center justify-between p-[30px] pb-[26px]">
      <span className="font-secondary text-[12px] font-semibold uppercase leading-[13px] tracking-[1.56px] text-[#D2D9E1]">
        {title}
      </span>
      <span className="opacity-50 transition-all duration-300 group-hover:translate-x-1 group-hover:opacity-100">
        <svg
          width="10"
          height="16"
          viewBox="0 0 10 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.71552 13V11.973L7.64052 9.152H0.0615234V7.748H7.64052L4.71552 4.927V3.9H5.84652L9.94152 8.008V8.905L5.84652 13H4.71552Z"
            fill="#E9EDF1"
          />
        </svg>
      </span>
    </div>
  </a>
);

const SOCIAL_MAP = {
  x: {
    title: "x.com",
    href: LINKS.x,
    icon: <IconX />,
    className: "bg-[#000]",
  },
  discord: {
    title: "discord",
    href: LINKS.discord,
    icon: <IconDiscord />,
    className: "bg-[#0064C7]",
  },
  youtube: {
    title: "Youtube",
    href: LINKS.youtube,
    icon: <IconYouTube />,
    className: "bg-[#FF3D0C]",
  },
  docs: {
    title: "Docs",
    href: LINKS.docs,
    icon: <IconDocs />,
    className: "bg-[#38A430]",
  },
};
export const BackedSocial = ({ social }: { social: SocialType[] }) => {
  return (
    <div className="flex flex-col">
      <div className="border-foreground/10 mx-5 max-w-[1140px] grow border-t lg:mx-auto lg:w-full" />
      <div className="overflow-hidden pt-10">
        <div className="flex w-full flex-row gap-5 max-lg:overflow-x-scroll max-lg:px-5">
          {social.map((item) => {
            const { icon, className, title } =
              SOCIAL_MAP[item.name as keyof typeof SOCIAL_MAP];
            return (
              <Item
                key={item._key}
                href={item.url}
                className={className}
                title={title}
                icon={icon}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
