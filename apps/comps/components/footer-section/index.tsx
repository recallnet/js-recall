"use client";

import Image from "next/image";
import React from "react";
import { FaDiscord, FaReddit, FaYoutube } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

interface FooterSectionProps {
  dark?: boolean;
}

export const FooterSection: React.FC<FooterSectionProps> = () => {
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
    { icon: FaXTwitter, url: "/" },
    { icon: FaDiscord, url: "/" },
    { icon: FaYoutube, url: "/" },
    { icon: FaReddit, url: "/" },
  ];

  return (
    <section className="relative left-1/2 right-1/2 mx-[-50vw] flex w-screen justify-center bg-white px-10 py-5 text-gray-500">
      <div className="max-w-[2000px] md:w-full xl:w-[1500px]">
        <div className="mb-8 h-1 w-full border-b-2 border-gray-200"></div>
        <div className="grid grid-cols-1 content-center gap-4 border md:grid-cols-5">
          <Image src="/logo_white.png" alt="recallnet" height={65} width={65} />
          <div className="flex flex-col justify-center space-y-1">
            {linkBlock1.map(({ text, link }, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="mb-0 text-xs"
              >
                {text}
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
                className="mb-0 text-xs"
              >
                {text}
              </a>
            ))}
          </div>
          <div className="col-span-2 flex justify-end gap-10">
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <link.icon className="text-xl text-gray-400" />
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 flex h-10 w-full justify-center border-x-2 border-t-2 border-gray-200 pt-3 text-xs font-semibold text-gray-400">
          <span>Copyright 2025 / Textile / All rights reserved.</span>
        </div>
      </div>
    </section>
  );
};
