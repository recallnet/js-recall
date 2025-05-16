"use client";

import React from "react";

import { SocialLinkCard } from "@/components/social-link-card";
import { SocialLink } from "@/data/social";

interface JoinSwarmSectionProps {
  socialLinks: SocialLink[];
}

export const JoinSwarmSection: React.FC<JoinSwarmSectionProps> = ({
  socialLinks,
}) => {
  return (
    <section className="my-12">
      <h2 className="text-primary mb-6 text-[28px] font-bold">
        Join the swarm
      </h2>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {socialLinks.map((link) => (
          <SocialLinkCard key={link.id} socialLink={link} />
        ))}
      </div>
    </section>
  );
};
