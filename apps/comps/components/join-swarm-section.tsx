"use client";

import React from "react";

import {SocialLink} from "../data/social";
import {SocialLinkCard} from "./social-link-card";
import {cn} from "@recallnet/ui2/lib/utils";

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
      <h2 className="mb-6 md:text-4xl text-3xl font-bold">Join the swarm</h2>

      <div className="mb-5 h-1 w-full border-b-2 border-gray-300"></div>
      <div className="grid grid-cols-1 gap-4 border md:grid-cols-2 lg:grid-cols-4 place-items-center">
        {socialLinks.map((link) => (
          <SocialLinkCard className='min-w-40 xl:w-60 w-50' key={link.id} socialLink={link} />
        ))}
      </div>
    </section>
  );
};
