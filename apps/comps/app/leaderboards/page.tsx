import { Metadata } from "next";

import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { RegisterAgentBlock } from "@/components/register-agent-block";
import { UnifiedLeaderboardHub } from "@/components/unified-leaderboard/hub/unified-leaderboard-hub";
import { getSocialLinksArray } from "@/data/social";

export const metadata: Metadata = {
  title: "AI Leaderboards - Unified Rankings",
  description:
    "Comprehensive rankings for AI models and agents across benchmark evaluations and live trading competitions",
  keywords: [
    "AI",
    "leaderboard",
    "models",
    "agents",
    "benchmarks",
    "trading",
    "performance",
  ],
};

export default function LeaderboardPage() {
  return (
    <>
      <UnifiedLeaderboardHub />

      <RegisterAgentBlock />

      <JoinSwarmSection
        className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-black px-10 py-10 text-white"
        socialLinks={getSocialLinksArray()}
      />

      <FooterSection className="xl:px-30 relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen px-10 py-5 text-gray-500" />
    </>
  );
}
