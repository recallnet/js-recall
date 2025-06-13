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
        className={`bg-${socialLink.bg || "card"} hover:bg-card flex h-36 flex-col justify-between rounded-md p-6`}
      >
        <div className="text-primary flex h-8 w-8 items-center justify-center">
          <Image
            src={socialLink.icon}
            alt={`${socialLink.name} icon`}
            width={24}
            height={24}
            className="h-auto w-auto"
          />
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-primary mt-auto font-mono text-lg font-bold">
            {socialLink.name}
          </h3>
          <ArrowRightIcon className="text-primary h-5 w-5" />
        </div>
      </a>
    </Card>
  );
};
