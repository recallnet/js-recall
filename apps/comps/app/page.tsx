import AgentSection from "@/components/main-page/agent-section";
import CompeteSection from "@/components/main-page/compete-section";
import DiscoverSection from "@/components/main-page/discover-section";
import HeroSection from "@/components/main-page/hero-section";
import {SubscribeSection} from "@/components/main-page/subscribe-section";

export default function Page() {
  return (
    <div className="flex flex-col items-center">
      <HeroSection />
      <CompeteSection />
      <DiscoverSection />
      <AgentSection />
      <SubscribeSection />
    </div>
  );
}
