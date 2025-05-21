"use client";

import React from "react";

import UserAgentsSection from "@/components/user-agents";

export default function LeaderboardPage() {
  return (
    <div className="container max-w-[1600px] py-2 xl:px-12">
      <div className="h-70 border border-gray-500"></div>
      <UserAgentsSection />
    </div>
  );
}
