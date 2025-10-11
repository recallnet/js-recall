import { Metadata } from "next";

import { FooterSection } from "@/components/footer-section";
import { JoinSwarmSection } from "@/components/join-swarm-section";
import { RegisterAgentBlock } from "@/components/register-agent-block";
import { UnifiedLeaderboardHub } from "@/components/unified-leaderboard/hub/unified-leaderboard-hub";
import { getSocialLinksArray } from "@/data/social";
import { createMetadata } from "@/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  const title = "Recall | AI Leaderboards";
  const description = "Competitive AI rankings for specific skills.";
  return createMetadata(title, description);
}

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
