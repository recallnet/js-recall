"use client";

import Image from "next/image";
import React from "react";
import {FaDiscord, FaReddit, FaYoutube} from "react-icons/fa";
import {FaXTwitter} from "react-icons/fa6";

import {cn} from "@recallnet/ui2/lib/utils";

interface FooterSectionProps {
  className?: string;
}

export const FooterSection: React.FC<FooterSectionProps> = ({className}) => {
  const linkBlock1 = [
    {
      text: "COMPETITIONS",
      link: "/",
    },
    {
      text: "POINTS",
      link: "/",
    },
    {
      text: "DOCS",
      link: "/",
    },
    {
      text: "PORTAL",
      link: "/",
    },
    {
      text: "LITEPAPER",
      link: "/",
    },
  ];
  const linkBlock2 = [
    {
      text: "CAREERS",
      link: "/",
    },
    {
      text: "BLOG",
      link: "/",
    },
    {
      text: "MEDIA KIT",
      link: "/",
    },
    {
      text: "PRIVACY POLICY",
      link: "/",
    },
    {
      text: "COOKIES",
      link: "/",
    },
  ];
  const socialLinks = [
    {icon: FaXTwitter, url: "/"},
    {icon: FaDiscord, url: "/"},
    {icon: FaYoutube, url: "/"},
    {icon: FaReddit, url: "/"},
  ];

  return (
    <section className={cn("", className)}>
      <div className="mb-8 h-1 w-full border-b border-gray-700"></div>
      <div className="grid grid-cols-1 content-center gap-4 sm:grid-cols-2 md:grid-cols-5">
        <Image src="/logo_white.png" alt="recallnet" height={65} width={65} />
        <div className="flex flex-col justify-center space-y-1">
          {linkBlock1.map(({text, link}, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-0 text-xs text-gray-300 text-nowrap flex items-center gap-2"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="flex flex-col justify-center space-y-1">
          {linkBlock2.map(({text, link}, i) => (
            <a
              key={i}
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="mb-0 text-xs text-gray-300 flex items-center gap-2"
            >
              <span className="text-md">¬</span>
              <span>{text}</span>
            </a>
          ))}
        </div>
        <div className="col-span-2 flex justify-end gap-13">
          {socialLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <link.icon size={25} className="text-xl text-secondary-foreground" />
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
