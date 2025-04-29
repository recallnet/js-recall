"use client";

import { ArrowRightIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import React from "react";

import { SocialLink } from "../data/social";

interface SocialLinkCardProps {
  socialLink: SocialLink;
}

export const SocialLinkCard: React.FC<SocialLinkCardProps> = ({
  socialLink,
}) => {
  return (
    <a
      href={socialLink.url}
      target="_blank"
      rel="noopener noreferrer"
      className="bg-card hover:bg-card flex h-36 flex-col justify-between rounded-md p-6"
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
  );
};
