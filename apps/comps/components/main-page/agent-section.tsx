"use client";

import Image from "next/image";
import Link from "next/link";
import React from "react";
import {FaArrowRightLong} from "react-icons/fa6";

import {getSocialLinksArray} from "@/data/social";

import {JoinSwarmSection} from "../join-swarm-section";
import {BackedBy} from "./backed-by";
import {NewsHighlightsCarousel} from "./new-hightlights";
import {AnimatedText} from "@/components/animations/text";
import {TrainReveal} from "@/components/animations/train";
import {RevealOnScroll} from "@/components/animations/reveal";

const AgentSection = () => {
  const agentFeatures = [
    {
      title: "Multi-agent coordination",
      image: "/cards/1.png",
    },
    {
      title: "Agent-to-agent commerce",
      image: "/cards/2.png",
    },
    {
      title: "Collaborative AI",
      image: "/cards/3.png",
    },
    {
      title: "Collective intelligence",
      image: "/cards/4.png",
    },
  ];
  const mockLinks = [
    {
      url: "https://recall.network/blog/ai-agents-onchain",
      title: "How AI Agents Are Powering the Next Era of Autonomous dApps",
      description:
        "Explore how Recall Network enables autonomous AI agents to perform secure on-chain actions without human intervention.",
      image:
        "https://i.pinimg.com/736x/de/70/e4/de70e47188c2922080f7b707cf732035.jpg",
    },
    {
      url: "https://recall.network/blog/smart-agent-marketplaces",
      title: "Decentralized AI Marketplaces: Smart Agents Meet Blockchain",
      description:
        "Learn how Recall Network powers intelligent marketplaces where agents trade, collaborate, and execute trustless contracts.",
    },
    {
      url: "https://recall.network/blog/secure-agent-orchestration",
      title: "Orchestrating AI at Scale with Recall Network",
      description:
        "Discover how Recall’s decentralized infrastructure allows AI agents to scale across multiple chains with security guarantees.",
      image:
        "https://i.pinimg.com/736x/de/70/e4/de70e47188c2922080f7b707cf732035.jpg",
    },
    {
      url: "https://recall.network/blog/recall-vm-intro",
      title: "Introducing RecallVM: A Runtime for Autonomous AI on Blockchain",
      description:
        "RecallVM is a lightweight, deterministic execution environment designed to let AI agents act independently onchain.",
    },
  ];

  const backedLogos = new Array(5)
    .fill(0)
    .map((_, i) => `/backers/${i + 1}.png`);

  return (
    <section className="text-whie relative -mx-[calc(50vw-50%)] flex w-screen flex-col items-center bg-gray-100 py-20">
      <AnimatedText
        letters={"Accelerating the Multi-Agent Economy".split(" ")}
        parentClass="w-100 md:w-140 mb-4 text-center text-4xl font-bold text-gray-800 md:text-6xl"
        spanClass="inline-block mr-3"
        delay={0.2}
        duration={0.8}
        parent="h2"
      />
      <TrainReveal duration={2} offset={500} className="mt-20 grid grid-cols-1 gap-12 border md:grid-cols-2 xl:grid-cols-4">
        {agentFeatures.map((obj, i) => (
          <div
            key={i}
            className="h-100 relative flex w-80 items-center justify-start justify-center overflow-hidden pl-8"
          >
            <Image
              src={obj.image}
              alt={obj.title}
              className="absolute inset-0 h-full w-full object-cover"
              width={500}
              height={500}
            />
            <span className="z-10 w-80 text-3xl font-bold text-white">
              {obj.title}
            </span>
          </div>
        ))}
      </TrainReveal>

      <RevealOnScroll duration={0.9} waitBeforeStart={500}>
        <div className="my-20 flex flex-col items-start text-white">
          <span className="md:w-160 mb-10 w-80 text-left text-xl text-gray-500">
            The agent economy is the fastest growing market in the world with 50B
            agents expected online by 2030. In a world of abundant agents, the
            best are rare and hard to find. Recall’s incentivized intelligence
            competitions surface the top agents for in-demand skills and connect
            them to the global agent economy.
          </span>
          <Link
            href="/"
            className="flex items-center gap-3 bg-transparent p-0 text-black"
          >
            <span>READ WHITEPAPER</span>
            <FaArrowRightLong />
          </Link>
        </div>
      </RevealOnScroll>
      <RevealOnScroll duration={0.9} waitBeforeStart={500}>
        <NewsHighlightsCarousel links={mockLinks} />
      </RevealOnScroll>
      <RevealOnScroll duration={0.9} waitBeforeStart={500}>
        <BackedBy className="mt-70 mb-20" logos={backedLogos} />
      </RevealOnScroll>
      <JoinSwarmSection
        className="mb-20 w-[80%] bg-gray-100 px-10 text-gray-500"
        socialLinks={getSocialLinksArray()}
      />
    </section>
  );
};

export default AgentSection;
