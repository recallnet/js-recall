"use client";

import React from "react";

import {SocialLink} from "../data/social";
import {SocialLinkCard} from "./social-link-card";

interface JoinSwarmSectionProps {
  socialLinks: Record<string, SocialLink>;
}

export const JoinSwarmSection: React.FC<JoinSwarmSectionProps> = ({
  socialLinks,
}) => {
  return (
    <section className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-white text-gray-500 px-55 py-10">
      <h2 className="mb-6 text-4xl font-bold">
        Join the swarm
      </h2>

      <div className="h-1 border-b-2 border-gray-200 w-full mb-5"></div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 border">
        {socialLinks.map((link) => (
          <SocialLinkCard key={link.id} socialLink={link} />
        ))}
      </div>
    </section>
  );
};
