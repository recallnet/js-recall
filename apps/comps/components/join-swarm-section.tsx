"use client";

import React from "react";

import { cn } from "@recallnet/ui2/lib/utils";

import { SocialLinkCard } from "@/components/social-link-card";
import { SocialLink } from "@/data/social";

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

      <hr className="my-6" />
      <div className="place-items-around xs:grid-cols-4 grid grid-cols-2 gap-4">
        {socialLinks.map((link) => (
          <SocialLinkCard
            className="min-w-40 2xl:w-80"
            key={link.id}
            socialLink={link}
          />
        ))}
      </div>
    </section>
  );
};
