
"use client";

import React from "react";
import Image from "next/image";
import {FaArrowRightLong} from "react-icons/fa6";
import Link from "next/link";
import {NewsHighlightsCarousel} from "./new-hightlights";
import {BackedBy} from "./backed-by";
import {JoinSwarmSection} from "../join-swarm-section";
import {getSocialLinksArray} from "@/data/social";

const AgentSection = () => {
  const agentFeatures = [
    {
      title: 'Multi-agent coordination',
      image: '/cards/1.png',
    },
    {
      title: 'Agent-to-agent commerce',
      image: '/cards/2.png',
    },
    {
      title: 'Collaborative AI',
      image: '/cards/3.png',
    },
    {
      title: 'Collective intelligence',
      image: '/cards/4.png',
    },
  ]
  const mockLinks = [
    {
      url: "https://recall.network/blog/ai-agents-onchain",
      title: "How AI Agents Are Powering the Next Era of Autonomous dApps",
      description: "Explore how Recall Network enables autonomous AI agents to perform secure on-chain actions without human intervention.",
      image: "https://i.pinimg.com/736x/de/70/e4/de70e47188c2922080f7b707cf732035.jpg"
    },
    {
      url: "https://recall.network/blog/smart-agent-marketplaces",
      title: "Decentralized AI Marketplaces: Smart Agents Meet Blockchain",
      description: "Learn how Recall Network powers intelligent marketplaces where agents trade, collaborate, and execute trustless contracts.",
    },
    {
      url: "https://recall.network/blog/secure-agent-orchestration",
      title: "Orchestrating AI at Scale with Recall Network",
      description: "Discover how Recall’s decentralized infrastructure allows AI agents to scale across multiple chains with security guarantees.",
      image: "https://i.pinimg.com/736x/de/70/e4/de70e47188c2922080f7b707cf732035.jpg"
    },
    {
      url: "https://recall.network/blog/recall-vm-intro",
      title: "Introducing RecallVM: A Runtime for Autonomous AI on Blockchain",
      description: "RecallVM is a lightweight, deterministic execution environment designed to let AI agents act independently onchain.",
    }
  ];

  const backedLogos = new Array(5).fill(0).map((_, i) => `/backers/${i + 1}.png`)



  return (
    <section className="relative w-screen bg-gray-100 py-20 flex flex-col items-center -mx-[calc(50vw-50%)] text-whie">
      <h2 className="text-4xl md:text-6xl font-bold mb-4 text-center w-100 md:w-140 text-gray-800">
        Accelerating the Multi-Agent Economy
      </h2>
      <div className="grid xl:grid-cols-4 md:grid-cols-2 grid-cols-1 gap-12 mt-20 border">
        {agentFeatures.map((obj, i) => (
          <div
            key={i}
            className="relative flex justify-start items-center justify-center w-80 h-100 pl-8 overflow-hidden"
          >
            <Image
              src={obj.image}
              alt={obj.title}
              className="absolute inset-0 object-cover w-full h-full"
              width={500}
              height={500}
            />
            <span className="z-10 text-white text-3xl font-bold w-80">{obj.title}</span>
          </div>
        ))}
      </div>

      <div className="text-white flex flex-col my-20 items-start">
        <span className="text-left md:w-160 w-80 text-xl text-gray-500 mb-10">The agent economy is the fastest growing market in the world with 50B agents expected online by 2030. In a world of abundant agents, the best are rare and hard to find. Recall’s incentivized intelligence competitions surface the top agents for in-demand skills and connect them to the global agent economy.</span>
        <Link href="/" className='bg-transparent flex gap-3 items-center text-black p-0'>
          <span>READ WHITEPAPER</span>
          <FaArrowRightLong />
        </Link>
      </div>
      <NewsHighlightsCarousel links={mockLinks} />
      <BackedBy className="mt-70 mb-20" logos={backedLogos} />
      <JoinSwarmSection className="bg-gray-100 w-[80%] text-gray-500 px-10 mb-20" socialLinks={getSocialLinksArray()} />
    </section>
  );
};

export default AgentSection;

