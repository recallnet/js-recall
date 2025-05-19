"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import React from "react";

import Card from "@/../../packages/ui2/src/components/shadcn/card";
import { SocialLink } from "@/data/social";

interface SocialLinkCardProps {
  socialLink: SocialLink;
}

export const SocialLinkCard: React.FC<SocialLinkCardProps> = ({
  socialLink,
}) => {
  return (
    <Card
      corner="bottom-left"
      cropSize={30}
      className={`bg-${socialLink.bg} h-45 flex-col p-6`}
    >
      <a
        href={socialLink.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-full w-full flex-col justify-between"
      >
        <div className="text-primary flex h-8 w-8 items-center justify-center">
          <Image
            src={socialLink.icon}
            alt={`${socialLink.name} icon`}
            width={24}
            height={24}
          />
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-primary mt-auto text-lg font-bold">
            {socialLink.name}
          </h3>
          <ArrowRightIcon className="text-primary h-5 w-5" />
        </div>
      </a>
    </Card>
  );
};
