"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import React from "react";

import { Card } from "@recallnet/ui2/components/card";

import { SocialLink } from "@/data/social";

interface SocialLinkCardProps {
  socialLink: SocialLink;
  className?: string;
}

export const SocialLinkCard: React.FC<SocialLinkCardProps> = ({
  socialLink,
  className,
}) => {
  return (
    <Card cropSize={35} corner="bottom-left" className={className}>
      <a
        href={socialLink.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`bg-${socialLink.bg || "card"} hover:bg-card flex h-16 flex-col justify-between rounded-md p-4`}
      >
        <div className="flex items-center pl-6">
          <div className="flex min-w-0 flex-1 items-center">
            <Image
              src={socialLink.icon}
              alt={`${socialLink.name} icon`}
              width={24}
              height={24}
              className="h-auto w-auto flex-shrink-0"
            />
            <div className="text-primary truncate pl-2 font-mono font-bold">
              {socialLink.name}
            </div>
          </div>
          <ArrowRightIcon className="text-primary ml-4 h-5 w-5 flex-shrink-0" />
        </div>
      </a>
    </Card>
  );
};
