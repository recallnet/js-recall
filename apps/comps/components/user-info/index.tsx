"use client";

import Image from "next/image";
import React, { useState } from "react";
import { FaPenToSquare } from "react-icons/fa6";

import { cn } from "@recallnet/ui2/lib/utils";

export default function UserInfoSection() {
  const [user, setUser] = useState({
    name: "User 1",
    email: "sample@developer.com",
    image: "/default_user.png",
    website: "https://maximumdev.com/github",
  });

  const [editField, setEditField] = useState<"email" | "website" | null>(null);
  const [inputValues, setInputValues] = useState({
    email: user.email,
    website: user.website,
  });

  const handleSave = (field: "email" | "website") => {
    setUser((prev) => ({ ...prev, [field]: inputValues[field] }));
    setEditField(null);
  };

  return (
    <div className="h-70 flex w-full border border-gray-500">
      <Image
        src={user.image}
        alt="agent"
        className="pointer-events-none hidden h-full sm:block"
        width={350}
        height={350}
      />
      <div className="flex w-full flex-col items-start justify-center gap-5 p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-bold">{user.name}</h2>
          <BadgeCheckIcon className="text-green-500" />
        </div>

        {/* Email row */}
        <div className="flex w-full items-center gap-4 text-gray-500">
          <span className="w-20 font-semibold text-white">E-mail</span>
          {editField === "email" ? (
            <>
              <input
                type="text"
                className="w-full max-w-sm rounded bg-gray-700 p-2 text-white"
                value={inputValues.email}
                onChange={(e) =>
                  setInputValues((v) => ({ ...v, email: e.target.value }))
                }
              />
              <button
                className="ml-2 text-sm text-blue-400 hover:underline"
                onClick={() => handleSave("email")}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <FaPenToSquare
                className="h-5 w-5 cursor-pointer"
                onClick={() => setEditField("email")}
              />
              <span className="ml-8">{user.email}</span>
            </>
          )}
        </div>

        {/* Website row */}
        <div className="flex w-full items-center gap-4 text-gray-500">
          <span className="w-20 font-semibold text-white">Website</span>
          {editField === "website" ? (
            <>
              <input
                type="text"
                className="w-full max-w-sm rounded bg-gray-700 p-2 text-white"
                value={inputValues.website}
                onChange={(e) =>
                  setInputValues((v) => ({ ...v, website: e.target.value }))
                }
              />
              <button
                className="ml-2 text-sm text-blue-400 hover:underline"
                onClick={() => handleSave("website")}
              >
                Save
              </button>
            </>
          ) : (
            <>
              <FaPenToSquare
                className="h-5 w-5 cursor-pointer"
                onClick={() => setEditField("website")}
              />
              <span className="ml-8">{user.website}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const BadgeCheckIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m8.032 12 1.984 1.984 4.96-4.96m4.55 5.272.893-.893a1.984 1.984 0 0 0 0-2.806l-.893-.893a1.984 1.984 0 0 1-.581-1.403V7.04a1.984 1.984 0 0 0-1.984-1.984h-1.262a1.983 1.983 0 0 1-1.403-.581l-.893-.893a1.984 1.984 0 0 0-2.806 0l-.893.893a1.984 1.984 0 0 1-1.403.581H7.04A1.984 1.984 0 0 0 5.055 7.04v1.262c0 .527-.209 1.031-.581 1.403l-.893.893a1.984 1.984 0 0 0 0 2.806l.893.893c.372.372.581.876.581 1.403v1.262a1.984 1.984 0 0 0 1.984 1.984h1.262c.527 0 1.031.209 1.403.581l.893.893a1.984 1.984 0 0 0 2.806 0l.893-.893a1.985 1.985 0 0 1 1.403-.581h1.262a1.984 1.984 0 0 0 1.984-1.984V15.7c0-.527.209-1.031.581-1.403Z"
      />
    </svg>
  );
};
