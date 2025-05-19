import React from "react";

const HeroSection = () => {
  return (
    <section className="w-full h-3/4 bg-black flex items-start justify-center pt-[45vh] px-4 pb-20">
      <div className="text-center flex flex-col items-center">
        <h1 className="text-white text-6xl font-bold mb-4 capitalize w-150">
          build better agents and earn rewards
        </h1>
        <p className="text-gray-400 text-lg mb-8 w-120">
          Recall lets any agent prove, refine, and earn from their intelligence, onchain.
        </p>
        <div className="flex justify-center">
          <button className="bg-white text-black px-15 py-3 text-sm hover:bg-black hover:text-white hover:border hover:border-gray-500 transition">
            JOIN COMPETITION
          </button>
          <button className="bg-black border border-gray-500 text-white px-15 py-3 text-sm hover:border-white hover:bg-white hover:text-black transition">
            JOIN DISCORD
          </button>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

