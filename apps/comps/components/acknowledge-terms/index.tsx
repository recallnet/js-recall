"use client"

import {Cross1Icon} from "@radix-ui/react-icons"
import React from "react"

export const TermsModal: React.FC<unknown> = () => {
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

        <h2 className="text-2xl font-semibold text-white mb-4">Acknowledge terms</h2>

        <p className="text-sm text-white mb-7">
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur
          commodo quam vitae augue volutpat, nec lacinia justo tempus.
        </p>

        <div className="rounded-md border border-gray-600 p-4 max-h-60 overflow-y-auto">
          <h3 className="text-sm font-medium text-white mb-2">Terms of Use</h3>
          <p className="text-sm text-gray-400 mb-5">
            Last updated: 9 January 2025
          </p>
          <p className="text-sm text-gray-400">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi ut
            orci nec ligula laoreet aliquet. Sed a orci sit amet lorem egestas
            mattis. Nunc nec odio vel est placerat dapibus. Donec blandit diam
            non augue sagittis, ut pretium nisi ullamcorper. Pellentesque id
            pharetra neque. Etiam in accumsan orci, ut luctus erat. Duis in
            mattis lectus. Vivamus sodales euismod nulla, in finibus lacus
            iaculis sed. In bibendum nisi libero, at facilisis sapien facilisis
            id. Integer consectetur augue et ex fermentum rutrum.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-500 px-10 py-4 text-sm font-medium text-white hover:bg-gray-600"
          >
            CLOSE
          </button>
          <button
            onClick={onAgree}
            className="rounded-md bg-blue-700 px-10 py-4 text-sm font-semibold text-white hover:bg-blue-500"
          >
            AGREE & SIGN
          </button>
        </div>
      </div>
    </div>
  )
}

