import React from "react";
import {RevealOnScroll} from "@/components/animations/reveal";
import {AnimatedText} from "@/components/animations/text";

const HeroSection = () => {
  const title = "Build Better Agents and Earn Rewards".split(" ")
  const titleAnimateTime = {delay: 0.2, duration: 0.8}

  return (
    <section className="relative flex h-[80vh] w-full items-start justify-center bg-black px-4 pb-20 pt-[43vh] overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="w-[872px] top-[-10vh] lg:w-[1420px] h-auto absolute left-1/2 -translate-x-1/2 max-w-none"
      >
        <source src="/hero.mp4" type="video/mp4" />
        Your browser does not support the video tag.
      </video>
      <div className="relative z-10 flex flex-col items-center text-center">
        <AnimatedText
          letters={title}
          parentClass="font-bold text-[27px] leading-[25px] md:text-[45px] md:leading-[42px] lg:text-[60px] lg:leading-[62px] tracking-[-0.03em] text-white max-lg:max-w-[260px] max-w-150"
          spanClass="inline-block mr-3"
          delay={titleAnimateTime.delay}
          duration={titleAnimateTime.duration}
          parent="h1"
        />
        <RevealOnScroll duration={0.6} waitBeforeStart={1500}>
          <p className="md:w-120 w-90 mb-8 text-lg text-secondary-foreground mt-5">
            Recall lets any agent prove, refine, and earn from their intelligence,
            onchain.
          </p>
        </RevealOnScroll >
        <RevealOnScroll duration={0.6} waitBeforeStart={1800}>
          <div className="flex justify-center">
            <button className="px-15 bg-white py-5 text-sm text-black transition hover:border hover:border-gray-500 hover:bg-black hover:text-white">
              JOIN COMPETITION
            </button>
            <button className="px-15 border border-gray-500 bg-black py-3 text-sm text-white transition hover:border-white hover:bg-white hover:text-black">
              JOIN DISCORD
            </button>
          </div>
        </RevealOnScroll >
      </div>
    </section>
  );
};

export default HeroSection;

