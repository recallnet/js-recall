"use client"

import {Cross1Icon} from "@radix-ui/react-icons"
import React from "react"

export const StakeToJoin: React.FC<unknown> = () => {
  const [open, setOpen] = React.useState(true)

  const onClose = () => {setOpen(false)}
  const onAgree = () => {setOpen(false)}

  if (!open)
    return <></>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="relative w-full max-w-lg rounded-lg bg-gray-800 px-8 py-5 shadow-lg">
        <button
          className="absolute right-4 top-4 text-white hover:text-white"
          onClick={onClose}
        >
          <Cross1Icon width={25} height={25} />
        </button>

        <h2 className="text-2xl font-semibold text-white mb-4">Stake $RECALL to join</h2>

        <div className="w-full p-3 bg-gray-600 flex flex-col justify-between items-center text-sm mb-10">
          <div className="flex justify-between gap-3 w-full">
            <span className="text-gray-400">COMPETITION</span>
            <span className="text-gray-400">MIN STAKING AMOUNT</span>
          </div>
          <div className="flex justify-between items-center w-full">
            <div className="w-12 h-1 bg-white rounded" />
            <span className="text-white">100 $RECALL</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 mb-30 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">STAKING AMOUNT</span>
            <div className="flex gap-2">
              <span className="text-gray-400">WALLET BALANCE</span>
              <span className="text-white">1,000</span>
            </div>
          </div>
          <div className="text-white rounded-md border border-gray-600 p-4 h-10 flex justify-between items-center">
            <span >100</span>
            <span >Max</span>
          </div>
        </div>

        <button
          onClick={onAgree}
          className="bg-blue-700 px-10 py-4 text-sm font-semibold text-white hover:bg-blue-500 w-full text-sm"
        >
          STAKE & JOIN
        </button>
      </div>
    </div>
  )
}

