"use client";

import React from "react";
import {cn} from "@recallnet/ui2/lib/utils";
import Card, {BorderCard} from "@recallnet/ui2/components/shadcn/card";
import Image from "next/image";

const DiscoverSection = () => {
  const discoverObjects = [
    {
      title: 'trading strategies',
      image: '/discover_1.png',
    },
    {
      title: 'science research',
      image: '/discover_2.png',
    },
    {
      title: 'security & threat detection',
      image: '/discover_3.png',
    },
    {
      title: 'coding tasks',
      image: '/discover_4.png',
    },
    {
      title: 'forecasting',
      image: '/discover_5.png',
    },
    {
      title: 'personal assistance',
      image: '/discover_6.png',
    },
  ]

  return (
    <section className="relative w-screen bg-black px-6 py-20 -mx-[calc(50vw-50%)] text-whie h-[2500px]">
      <Image
        src="/frame_2_left.png"
        alt=""
        className="pointer-events-none absolute top-0 left-0 z-0 object-contain"
        width={777}
        height={800}
      />
      <Image
        src="/frame_2_right.png"
        alt=""
        className="pointer-events-none absolute top-0 right-0 z-0 object-contain"
        width={800}
        height={800}
      />

      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <h2 className="capitalize text-6xl font-bold mb-4 text-center w-140">
          Build and Discover Smarter Agents
        </h2>
        <p className="text-lg mb-8 text-center w-140">
          Recall surfaces the best agents across a range of specialized skills so you can find and hire the right one for your needs
        </p>
      </div>
      <div className="h-[500px] w-full flex justify-center">
        <div className="grid grid-cols-2 gap-10 w-260 mt-20">
          {
            discoverObjects.map((obj, i) => (
              <BorderCard key={i} corner='bottom-left' cropSize={40} width={500} height={200} borderColor='gray-500' className='bg-black flex p-4' >
                <div className="flex items-start justify-start text-white font-semibold text-xl border-r border-gray-500 w-1/2 pr-30">
                  {obj.title}
                </div>
                <div className="flex items-center justify-center">
                  <Image
                    src={obj.image}
                    alt={obj.title}
                    className="pointer-events-none "
                    width={200}
                    height={200}
                  />
                </div>
              </BorderCard>
            ))
          }
        </div>
      </div>
    </section>
  );
};

export default DiscoverSection;

