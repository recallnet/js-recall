"use client";

import Image from "next/image";
import React from "react";

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

  return (
    <footer className={cn("mt-10", className)}>
      <div className="border-y py-10">
        <div className="max-w-5xl">
          <div className="xs:grid-cols-5 grid grid-cols-3 content-center gap-8 font-normal">
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
          </div>
        </div>
      </div>
      <span className="text-secondary-foreground block py-4 text-center text-xs">
        Copyright 2025 / Recall Labs / All rights reserved.
      </span>
    </footer>
  );
};
