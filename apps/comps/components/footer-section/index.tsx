"use client";

import Image from "next/image";
import React from "react";
import {
  FaDiscord,
  //FaReddit,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import { cn } from "@recallnet/ui2/lib/utils";

interface FooterSectionProps {
  className?: string;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ className }) => {
  const linkBlock1 = [
    {
      text: "COMPETITIONS",
      link: "https://docs.recall.network/competitions?_gl=1*t8wkr1*_ga*MTA4ODU0MDgyOC4xNzQ4Mzc2MTQ0*_ga_6PQ6Y1X43M*czE3NDg0NDgzMDQkbzQkZzEkdDE3NDg0NDgzMjMkajQxJGwwJGgw",
    },
    {
      text: "POINTS",
      link: "https://points.recall.network/",
    },
    {
      text: "DOCS",
      link: "https://docs.recall.network/?_gl=1*1q3afh2*_ga*MTA4ODU0MDgyOC4xNzQ4Mzc2MTQ0*_ga_6PQ6Y1X43M*czE3NDg0NDgzMDQkbzQkZzEkdDE3NDg0NDgzMjMkajQxJGwwJGgw",
    },
    {
      text: "PORTAL",
      link: "/",
    },
    {
      text: "LITEPAPER",
      link: "https://docs.recall.network/?_gl=1*1q3afh2*_ga*MTA4ODU0MDgyOC4xNzQ4Mzc2MTQ0*_ga_6PQ6Y1X43M*czE3NDg0NDgzMDQkbzQkZzEkdDE3NDg0NDgzMjMkajQxJGwwJGgw",
    },
  ];
  const linkBlock2 = [
    {
      text: "CAREERS",
      link: "https://job-boards.greenhouse.io/recall",
    },
    {
      text: "BLOG",
      link: "https://paragraph.com/@recall",
    },
    {
      text: "MEDIA KIT",
      link: "https://flat-agustinia-3f3.notion.site/Recall-Launch-Media-Kit-196dfc9427de80de9d96e1dd85a8b036",
    },
    {
      text: "PRIVACY POLICY",
      link: "https://recall.network/privacy",
    },
    {
      text: "COOKIES",
      link: "https://recall.network/privacy",
    },
  ];
  const socialLinks = [
    { icon: FaXTwitter, url: "https://x.com/recallnet" },
    { icon: FaDiscord, url: "https://discord.com/invite/recallnet" },
    {
      icon: FaYoutube,
      url: "https://www.youtube.com/channel/UCpFqp6DtxvXaP7LUjxT3KpA",
    },
    //{icon: FaReddit, url: "/"},
  ];

  return (
    <section className={cn("", className)}>
      <div className="mb-8 h-1 w-full border-b border-gray-700"></div>
      <div className="grid grid-cols-1 content-center gap-4 sm:grid-cols-2 md:grid-cols-5">
        <Image src="/logo_white.png" alt="recallnet" height={65} width={65} />
        <div className="flex flex-col justify-center space-y-1">
          {linkBlock1.map(({ text, link }, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-0 flex items-center gap-2 text-nowrap text-xs text-gray-300"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="flex flex-col justify-center space-y-1">
          {linkBlock2.map(({ text, link }, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-0 flex items-center gap-2 text-xs text-gray-300"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="gap-13 col-span-2 flex justify-end">
          {socialLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <link.icon
                size={25}
                className="text-secondary-foreground text-xl"
              />
            </a>
          ))}
        </div>
      </div>
      <div className="mt-8 flex h-10 w-full justify-center border-x border-t border-gray-600 pt-3 text-xs font-semibold text-gray-400">
        <span>Copyright 2025 / Textile / All rights reserved.</span>
      </div>
    </section>
  );
};
