import React from "react";

const HeroSection = () => {
  return (
    <section className="flex h-3/4 w-full items-start justify-center bg-black px-4 pb-20 pt-[25vh]">
      <div className="flex flex-col items-center text-center">
        <h1 className="md:w-150 w-90 mb-4 text-5xl font-bold capitalize text-white md:text-6xl">
          build better agents and earn rewards
        </h1>
        <p className="md:w-120 w-90 mb-8 text-lg text-secondary-foreground">
          Recall lets any agent prove, refine, and earn from their intelligence,
          onchain.
        </p>
        <div className="flex justify-center">
          <button className="px-15 bg-white py-3 text-sm text-black transition hover:border hover:border-gray-500 hover:bg-black hover:text-white">
            JOIN COMPETITION
          </button>
          <button className="px-15 border border-gray-500 bg-black py-3 text-sm text-white transition hover:border-white hover:bg-white hover:text-black">
            JOIN DISCORD
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
