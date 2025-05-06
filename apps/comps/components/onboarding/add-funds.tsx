"use client"

import {ArrowRightIcon, LockClosedIcon, ReloadIcon} from "@radix-ui/react-icons"
import {Button} from "@recallnet/ui2/components/shadcn/button"
import Link from "next/link"
import {Hexagon} from "../hexagon"

export const AddFundsStep: React.FunctionComponent<unknown> = () => {
  return (
    <div className="flex flex-col w-full h-full items-center justify-center gap-6 p-6">
      <div className="flex justify-between md:w-xl sm:w-md w-[90%] h-1/3 bg-gray-800 shadow p-6 gap-4 border">
        <div className="flex items-center gap-3">
          <Hexagon className="bg-purple-800 text-sm">NEW</Hexagon>
          <Hexagon className="bg-gray-500"><LockClosedIcon /></Hexagon>
          <Hexagon className="bg-gray-500"><LockClosedIcon /></Hexagon>
        </div>

        <div className="flex flex-col w-[70%] justify-center text-center pl-6">
          <h2 className="text-primary font-bold text-sm">KEEP GOING!</h2>
          <p className="text-muted-foreground text-sm">1 OF 3 TROPHIES UNLOCKED</p>
        </div>
      </div>

      <div className="flex flex-col w-[50%] bg-gray-800 shadow p-6 gap-4 border">
        <h2 className="text-3xl font-bold">Add Funds</h2>

        <div className="flex flex-col gap-2">
          <div className="bg-gray-500 h-2 w-[80%] rounded" />
          <div className="bg-gray-500 h-2 w-4/6 rounded" />
        </div>

        <div className="mt-7 flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-start gap-3">
            <span className="text-gray-400">BALANCE</span>
            <span className="text-primary">0 $RECALL</span>
            <ReloadIcon className="text-sky-400 cursor-pointer" />
          </div>
          <Link
            href="https://docs.recall.com"
            target="_blank"
            className="text-sm text-primary cursor-pointer"
          >
            <div className="border-t border-muted-foreground/10 mt-9 mb-10 pt-4 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-primary font-semibold">Get Recall Tokens on Base</span>
                <span className="text-gray-400">Lorem ipsum dolor.</span>
              </div>
              <ArrowRightIcon />
            </div>
          </Link>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2 mt-4">
          <Button className="bg-gray-600 py-7 disabled:bg-gray-400 bg-blue-700 hover:bg-blue-600">CONTINUE</Button>
          <Button className="bg-transparent hover:bg-transparent">DO IT LATER</Button>
        </div>
      </div>
    </div >
  )
}

