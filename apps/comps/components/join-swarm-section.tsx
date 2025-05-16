"use client";

import React from "react";

import { SocialLink } from "../data/social";
import { SocialLinkCard } from "./social-link-card";

interface JoinSwarmSectionProps {
  socialLinks: SocialLink[];
}

export const JoinSwarmSection: React.FC<JoinSwarmSectionProps> = ({
  socialLinks,
}) => {
  return (
    <section className="px-55 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-white py-10 text-gray-500">
      <h2 className="mb-6 text-4xl font-bold">Join the swarm</h2>

      <div className="mb-5 h-1 w-full border-b-2 border-gray-200"></div>
      <div className="grid grid-cols-1 gap-4 border md:grid-cols-2 lg:grid-cols-4">
        {socialLinks.map((link) => (
          <SocialLinkCard key={link.id} socialLink={link} />
        ))}
      </div>
    </section>
  );
};
