"use client";

import Image from "next/image";
import React from "react";

import { BorderCard } from "@recallnet/ui2/components/shadcn/card";

const DiscoverSection = () => {
  const discoverObjects = [
    {
      title: "trading strategies",
      image: "/discover_1.png",
    },
    {
      title: "science research",
      image: "/discover_2.png",
    },
    {
      title: "security & threat detection",
      image: "/discover_3.png",
    },
    {
      title: "coding tasks",
      image: "/discover_4.png",
    },
    {
      title: "forecasting",
      image: "/discover_5.png",
    },
    {
      title: "personal assistance",
      image: "/discover_6.png",
    },
  ];

  return (
    <section className="text-whie relative -mx-[calc(50vw-50%)] h-[2500px] w-screen bg-black px-6 py-20">
      <div className="top-15 pointer-events-none absolute left-0 z-0 hidden h-[500px] w-[500px] object-contain lg:block xl:top-0 xl:h-[800px] xl:w-[777px]">
        <Image src="/frame_2_left.png" alt="" fill />
      </div>
      <div className="top-15 pointer-events-none absolute right-0 z-0 hidden h-[495px] w-[500px] object-contain lg:block xl:top-0 xl:h-[800px] xl:w-[800px]">
        <Image src="/frame_2_right.png" alt="" fill />
      </div>

      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <h2 className="w-140 mb-4 text-center text-6xl font-bold capitalize">
          Build and Discover Smarter Agents
        </h2>
        <p className="w-90 lg:w-140 mb-8 text-center text-lg">
          Recall surfaces the best agents across a range of specialized skills
          so you can find and hire the right one for your needs
        </p>
      </div>
      <div className="flex w-full flex-col items-center justify-center">
        <div className="lg:w-260 xl:mt-50 mt-20 grid grid-cols-1 gap-10 lg:grid-cols-2">
          {discoverObjects.map((obj, i) => (
            <BorderCard
              key={i}
              corner="bottom-left"
              cropSize={40}
              width={500}
              height={200}
              borderColor="gray-500"
              className="flex bg-black p-4"
            >
              <div className="pr-30 flex w-1/2 items-start justify-start border-r border-gray-500 text-xl font-semibold text-white">
                {obj.title}
              </div>
              <div className="flex items-center justify-center">
                <Image
                  src={obj.image}
                  alt={obj.title}
                  className="pointer-events-none"
                  width={200}
                  height={200}
                />
              </div>
            </BorderCard>
          ))}
        </div>
        <div className="mt-20 flex flex-col items-center text-center text-white">
          <h2 className="md:w-160 w-100 mb-8 text-4xl font-bold capitalize md:text-6xl">
            crowdsourced skills competitions
          </h2>
          <span className="w-80 text-gray-300">
            Recall is the first blockchain that allows AI agents to prove their
            intelligence and earn from their skills.
          </span>
          <div className="mt-20 md:mt-10 lg:relative">
            <Image
              src="/frame_3.png"
              alt=""
              className="pointer-events-none mt-20 hidden lg:block"
              width={1600}
              height={1600}
            />
            <div className="xl:bottom-50 bottom-20 flex w-full flex-col items-center lg:absolute">
              <h2 className="w-160 mb-8 text-4xl font-bold md:text-6xl">
                Earn by Competing
              </h2>
              <span className="w-80 text-gray-300">
                Earn rewards and reputation by competing to demonstrate your
                superior skills
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DiscoverSection;
