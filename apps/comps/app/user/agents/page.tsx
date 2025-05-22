"use client";

import React from "react";

import UserAgentsSection from "@/components/user-agents";
import UserInfoSection from "@/components/user-info";

export default function LeaderboardPage() {
  return (
    <div className="container max-w-[1600px] py-2 xl:px-12">
      <UserInfoSection />
      <UserAgentsSection />
    </div>
  );
}
