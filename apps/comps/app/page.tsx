import CompeteSection from "@/components/main-page/compete-section";
import HeroSection from "@/components/main-page/hero-section";

export default function Page() {
  return (
    <div className="flex flex-col items-center">
      <HeroSection />
      <CompeteSection />
    </div>
  );
}
