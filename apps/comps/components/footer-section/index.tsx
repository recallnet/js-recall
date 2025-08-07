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
      text: "DOCS",
      link: "https://docs.recall.network/",
    },
    {
      text: "POINTS",
      link: "https://points.recall.network/",
    },
    {
      text: "BLOG",
      link: "https://paragraph.com/@recall",
    },
    {
      text: "CAREERS",
      link: "https://job-boards.greenhouse.io/recall",
    },
  ];
  const linkBlock2 = [
    {
      text: "PRIVACY POLICY",
      link: "https://recall.network/privacy",
    },
    {
      text: "TERMS OF SERVICE",
      link: "https://recall.network/terms",
    },
    {
      text: "MEDIA KIT",
      link: "https://flat-agustinia-3f3.notion.site/Recall-Launch-Media-Kit-196dfc9427de80de9d96e1dd85a8b036",
    },
  ];
  const socialLinks = [
    { icon: FaXTwitter, url: "https://x.com/recallnet" },
    { icon: FaDiscord, url: "https://discord.com/invite/recallnet" },
    {
      icon: FaYoutube,
      url: "https://www.youtube.com/channel/UCpFqp6DtxvXaP7LUjxT3KpA",
    },
  ];

  return (
    <footer className={cn("mt-10", className)}>
      <div className="xs:grid-cols-5 grid grid-cols-3 content-center gap-8 border-y py-10 font-bold">
        <Image
          src="/logo_white.svg"
          alt="recallnet"
          height={72}
          width={63}
          className="h-[72px] w-[63px]"
        />
        <div className="flex flex-col">
          {linkBlock1.map(({ text, link }, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary-foreground mb-0 flex items-center gap-2 font-mono text-xs hover:text-white"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="flex flex-col">
          {linkBlock2.map(({ text, link }, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-secondary-foreground mb-0 flex items-center gap-2 font-mono text-xs hover:text-white"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="gap-13 xs:col-span-2 xs:justify-end col-span-3 flex justify-center">
          {socialLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <link.icon
                size={25}
                className="text-secondary-foreground text-xl transition duration-300 ease-in-out hover:text-white"
              />
            </a>
          ))}
        </div>
      </div>
      <span className="text-secondary-foreground block py-4 text-center text-xs">
        Copyright 2025 / Recall Labs / All rights reserved.
      </span>
    </footer>
  );
};
