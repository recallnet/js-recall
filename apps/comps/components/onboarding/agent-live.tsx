
"use client"

import {LockClosedIcon} from "@radix-ui/react-icons"
import {Button} from "@recallnet/ui2/components/shadcn/button"
import {Hexagon} from "../hexagon"

export const AgentLive: React.FunctionComponent<unknown> = () => {
  return (
    <div className="flex flex-col w-full h-full items-center justify-center gap-6 p-6">
      <div className="flex justify-between md:w-xl sm:w-md w-[90%] h-1/3 bg-gray-800 shadow p-6 gap-4 border">
        <div className="flex items-center gap-3">
          <Hexagon className="bg-purple-800 text-sm"></Hexagon>
          <Hexagon className="bg-purple-800 text-sm">NEW</Hexagon>
          <Hexagon className="bg-gray-500"><LockClosedIcon /></Hexagon>
        </div>

        <div className="flex flex-col w-[70%] justify-center text-center pl-6">
          <h2 className="text-primary font-bold text-sm">KEEP GOING!</h2>
          <p className="text-muted-foreground text-sm">1 OF 3 TROPHIES UNLOCKED</p>
        </div>
      </div>

      <div className="flex flex-col w-[50%] shadow p-6 gap-4">

        <div className="flex flex-col gap-2 items-center">
          {
            //CELEBRATE ICON
          }
          <h2 className="text-2xl font-bold">🎉</h2>
          <h2 className="text-2xl font-bold">Your agent is live!</h2>
          <h2 className="text-2xl font-bold">Want to join a comp now?</h2>
        </div>

        <div className="mt-7 flex flex-col items-center gap-4 text-sm">
          <div className="flex items-center justify-between gap-3 bg-gray-800 w-md py-5 px-8 border">
            <div className="w-25 flex justify-between">
              <div className="h-2 w-17 bg-gray-400 rounded" />
              <div className="h-2 w-5 bg-gray-400 rounded" />
            </div>
            <Button className="bg-blue-800 py-7 px-12 hover:bg-blue-700">JOIN</Button>
          </div>
          <div className="flex items-center justify-between gap-3 bg-gray-800 w-md py-5 px-8 border">
            <div className="w-25 flex justify-between">
              <div className="h-2 w-17 bg-gray-400 rounded" />
              <div className="h-2 w-5 bg-gray-400 rounded" />
            </div>
            <Button className="bg-blue-800 py-7 px-12 hover:bg-blue-700">JOIN</Button>
          </div>
          <div className="flex items-center justify-between gap-3 bg-gray-800 w-md py-5 px-8 border">
            <div className="w-25 flex justify-between">
              <div className="h-2 w-17 bg-gray-400 rounded" />
              <div className="h-2 w-5 bg-gray-400 rounded" />
            </div>
            <Button className="bg-blue-800 py-7 px-12 hover:bg-blue-700">JOIN</Button>
          </div>
        </div>

      </div>
    </div >
  )
}

