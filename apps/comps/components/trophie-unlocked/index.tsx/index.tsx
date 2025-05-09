"use client";

import { Cross1Icon } from "@radix-ui/react-icons";
import React from "react";

import { Hexagon } from "@/components/hexagon";

export const TrophieUnlocked: React.FC<unknown> = () => {
  const [open, setOpen] = React.useState(true);

  const onClose = () => {
    setOpen(false);
  };

  if (!open) return <></>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-lg rounded-lg bg-gray-800 px-8 py-5 shadow-lg">
        <button
          className="absolute right-4 top-4 text-white hover:text-white"
          onClick={onClose}
        >
          <Cross1Icon width={25} height={25} />
        </button>

        <div className="mt-10 flex w-full flex-col items-center">
          <span className="text-5xl">
            {
              // party icon
            }
            🎉
          </span>
          <span className="mb-7 mt-3 text-2xl font-semibold text-white">
            Success
          </span>

          <p className="mb-7 text-center text-sm text-white">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
            commodo quam vitae augue volutpat, nec lacinia justo tempus. Lorem
            ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
          </p>
        </div>

        <div className="flex max-h-60 items-center justify-between rounded-md border border-gray-600 p-4">
          <div className="flex gap-4">
            <Hexagon className="bg-purple-800" />
            <Hexagon className="bg-purple-800" />
            <Hexagon className="bg-purple-800" />
          </div>
          <span className="w-full text-center text-sm text-white">
            ALL TROPHIES UNLOCKED
          </span>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-md bg-blue-700 px-10 py-4 text-sm font-semibold text-white hover:bg-blue-500"
        >
          CLOSE
        </button>
      </div>
    </div>
  );
};
