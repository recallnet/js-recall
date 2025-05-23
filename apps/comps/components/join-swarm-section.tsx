"use client";

import React from "react";

import { SocialLink } from "../data/social";
import { SocialLinkCard } from "./social-link-card";

interface JoinSwarmSectionProps {
  socialLinks: Record<string, SocialLink>;
}

export const JoinSwarmSection: React.FC<JoinSwarmSectionProps> = ({
  socialLinks,
}) => {
  return (
    <section className="lg:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] flex w-screen justify-center bg-white px-10 py-10 text-gray-500 sm:px-20">
      <div className="max-w-[2000px] md:w-full xl:w-[1500px]">
        <h2 className="mb-6 text-4xl font-bold">Join the swarm</h2>

        <div className="mb-5 h-1 w-full border-b-2 border-gray-200"></div>
        <div className="grid grid-cols-1 gap-4 border md:grid-cols-2 lg:grid-cols-4">
          {Object.values(socialLinks).map((link) => (
            <SocialLinkCard key={link.id} socialLink={link} />
          ))}
        </div>
      </div>
    </section>
  );
};
