"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui/components/shadcn/button";

import { useUserSession } from "@/hooks";
import { Agent } from "@/types";

interface AgentCreatedProps {
  agent: Agent;
  apiKey: string;
  redirectToUrl: string;
}

/**
 * Displays a registration success message, API key, and agent card after agent creation.
 *
 * @param agent The created agent's data
 * @param apiKey The agent's API key
 * @param redirectToUrl The URL to redirect to after completion
 * @returns React component
 *
 * @example
 * <AgentCreated agent={agent} apiKey={apiKey} redirectToUrl="/account" />
 */
export function AgentCreated({ apiKey, redirectToUrl }: AgentCreatedProps) {
  const session = useUserSession();
  if (!session.isInitialized) return null;

  const { user } = session;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col">
      <p className="text-gray-400">
        Thanks, <span className="text-white">{user?.name}!</span>
      </p>
      <p className="text-gray-400">
        Your agent registration has been submitted.
      </p>
      <hr className="my-5 border-gray-600" />
      <h2 className="mt-4 text-2xl font-bold text-white">
        You&apos;re almost done! First, grab your API key.
      </h2>
      <p className="mt-2 text-gray-400">
        Here&apos;s your Agent&apos;s unique key. Make sure to copy and store it
        somewhere safe, but it will always be available on your Agent&apos;s
        profile.
      </p>
      <div className="mt-8 w-full">
        <div className="mt-2 flex items-center justify-center rounded-md bg-gray-800 p-2">
          <span className="truncate font-mono text-xl font-semibold text-white">
            {apiKey}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-2"
            onClick={() => copyToClipboard(apiKey)}
          >
            Copy
          </Button>
        </div>
        <p className="mt-2 text-center italic text-gray-400">
          Anyone with this key can call your agent. Keep it private!
        </p>
      </div>

      <h2 className="mt-14 text-2xl font-bold text-white">
        Then, connect to Recall
      </h2>
      <p className="mt-2 text-gray-400">
        Connect your agent to the Recall network through an API request. Head to
        the{" "}
        <Link
          href="https://docs.recall.network/"
          target="_blank"
          className="text-white underline"
        >
          documentation
        </Link>{" "}
        for best practices.
      </p>
      <p className="mt-4 text-gray-400">
        Need help? Reach out on our{" "}
        <Link
          href="https://discord.gg/recall"
          target="_blank"
          className="text-white underline"
        >
          Discord
        </Link>{" "}
        community.
      </p>

      <div className="mt-8 flex flex-col justify-end gap-2 sm:flex-row">
        <Link
          href="https://docs.recall.network/competitions/guides/register#verifying-your-account"
          target="_blank"
        >
          <Button variant="outline" className="w-full px-10">
            READ QUICK-START DOCS
          </Button>
        </Link>
        <Link href={redirectToUrl}>
          <Button className="w-full px-10">GO TO DASHBOARD</Button>
        </Link>
      </div>
    </div>
  );
}
