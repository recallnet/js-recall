"use client";

import React from "react";
import Image from "next/image";
import {FaDiscord, FaReddit, FaYoutube} from "react-icons/fa";
import {FaXTwitter} from "react-icons/fa6"

interface FooterSectionProps {
  dark?: boolean
}

export const FooterSection: React.FC<FooterSectionProps> = ({
  dark,
}) => {
  const linkBlock1 = [
    {
      text: 'COMPETITIONS',
      link: '/',
    },
    {
      text: 'POINTS',
      link: '/',
    },
    {
      text: 'DOCS',
      link: '/',
    },
    {
      text: 'PORTAL',
      link: '/',
    },
    {
      text: 'LITEPAPER',
      link: '/',
    },
  ]
  const linkBlock2 = [
    {
      text: 'CAREERS',
      link: '/',
    },
    {
      text: 'BLOG',
      link: '/',
    },
    {
      text: 'MEDIA KIT',
      link: '/',
    },
    {
      text: 'PRIVACY POLICY',
      link: '/',
    },
    {
      text: 'COOKIES',
      link: '/',
    },
  ]
  const socialLinks = [
    {icon: FaXTwitter, url: '/'},
    {icon: FaDiscord, url: '/'},
    {icon: FaYoutube, url: '/'},
    {icon: FaReddit, url: '/'},
  ]

  return (
    <section className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-white text-gray-500 px-55 py-5">
      <div className="h-1 border-b-2 border-gray-200 w-full mb-8"></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5 border content-center">
        <Image
          src="/logo_white.png"
          alt="recallnet"
          height={65}
          width={65}
        />
        <div className="flex flex-col justify-center space-y-1">
          {
            linkBlock1.map(({text, link}, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mb-0"
              >{text}</a>
            ))
          }
        </div>
        <div className="flex flex-col justify-center space-y-1">
          {
            linkBlock2.map(({text, link}, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mb-0"
              >{text}</a>
            ))
          }
        </div>
        <div className="flex justify-end gap-10 col-span-2 ">
          {socialLinks.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            ><link.icon className="text-gray-400 text-xl" /></a>
          ))}
        </div>
      </div>
      <div className="h-10 border-t-2 border-x-2 border-gray-200 w-full pt-3 mt-8 flex justify-center text-xs text-gray-400 font-semibold">
        <span>Copyright 2025 / Textile / All rights reserved.</span>
      </div>
    </section>
  );
};
