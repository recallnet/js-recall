"use client"

import {Hexagon} from "@/components/hexagon"
import {Cross1Icon} from "@radix-ui/react-icons"
import React from "react"

export const TrophieUnlocked: React.FC<unknown> = () => {
  const [open, setOpen] = React.useState(true)

  const onClose = () => {setOpen(false)}

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

        <div className="flex flex-col items-center w-full mt-10">
          <span className="text-5xl">
            {
              // party icon
            }
            🎉
          </span>
          <span className="text-2xl text-white mb-7 font-semibold mt-3">
            Success
          </span>

          <p className="text-sm text-white text-center mb-7">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
            commodo quam vitae augue volutpat, nec lacinia justo tempus.
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
          </p>
        </div>

        <div className="rounded-md border border-gray-600 p-4 max-h-60 flex justify-between items-center">
          <div className="flex gap-4">
            <Hexagon className="bg-purple-800" />
            <Hexagon className="bg-purple-800" />
            <Hexagon className="bg-purple-800" />
          </div>
          <span className="text-white text-sm text-center w-full">ALL TROPHIES UNLOCKED</span>
        </div>

        <button
          onClick={onClose}
          className="rounded-md bg-blue-700 mt-5 px-10 py-4 text-sm font-semibold text-white hover:bg-blue-500 w-full"
        >
          CLOSE
        </button>
      </div>
    </div>
  )
}

