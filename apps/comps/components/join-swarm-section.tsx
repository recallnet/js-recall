"use client";

import React from "react";

import {cn} from "@recallnet/ui2/lib/utils";

import {SocialLink} from "../data/social";
import {SocialLinkCard} from "./social-link-card";

interface JoinSwarmSectionProps {
  className?: string;
  socialLinks: SocialLink[];
}

export const JoinSwarmSection: React.FC<JoinSwarmSectionProps> = ({
  className,
  socialLinks,
}) => {
  return (
    <section className={cn("", className)}>
      <h2 className="mb-6 text-3xl font-bold md:text-4xl">Join the swarm</h2>

      <div className="mb-5 h-1 w-full border-b border-gray-700"></div>
      <div className="grid grid-cols-1 place-items-center gap-4 md:grid-cols-2 lg:grid-cols-4">
        {socialLinks.map((link) => (
          <SocialLinkCard
            className="w-50 min-w-40 xl:w-60"
            key={link.id}
            socialLink={link}
          />
        ))}
      </div>
    </section>
  );
};
