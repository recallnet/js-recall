"use client";

import { Cross1Icon } from "@radix-ui/react-icons";
import React from "react";

export const StakeToJoin: React.FC<unknown> = () => {
  const [open, setOpen] = React.useState(true);

  const onClose = () => {
    setOpen(false);
  };
  const onAgree = () => {
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

        <h2 className="mb-4 text-2xl font-semibold text-white">
          Stake $RECALL to join
        </h2>

        <div className="mb-10 flex w-full flex-col items-center justify-between bg-gray-600 p-3 text-sm">
          <div className="flex w-full justify-between gap-3">
            <span className="text-gray-400">COMPETITION</span>
            <span className="text-gray-400">MIN STAKING AMOUNT</span>
          </div>
          <div className="flex w-full items-center justify-between">
            <div className="h-1 w-12 rounded bg-white" />
            <span className="text-white">100 $RECALL</span>
          </div>
        </div>

        <div className="mb-30 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">STAKING AMOUNT</span>
            <div className="flex gap-2">
              <span className="text-gray-400">WALLET BALANCE</span>
              <span className="text-white">1,000</span>
            </div>
          </div>
          <div className="flex h-10 items-center justify-between rounded-md border border-gray-600 p-4 text-white">
            <span>100</span>
            <span>Max</span>
          </div>
        </div>

        <button
          onClick={onAgree}
          className="w-full bg-blue-700 px-10 py-4 text-sm font-semibold text-white hover:bg-blue-500"
        >
          STAKE & JOIN
        </button>
      </div>
    </div>
  );
};
