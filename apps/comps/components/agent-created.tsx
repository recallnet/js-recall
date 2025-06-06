"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { socialLinks } from "@/data/social";
import { Agent } from "@/types/agent";

import { AgentCard } from "./user-agents";

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
 * @returns React component
 *
 * @example
 * <AgentCreated agent={agent} apiKey={apiKey} />
 */
export function AgentCreated({
  agent,
  apiKey,
  redirectToUrl,
}: AgentCreatedProps) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-12">
      <h2 className="mb-2 text-2xl font-bold text-white">
        Registration Submitted!
      </h2>
      <p className="mb-1 text-gray-300">Thanks, {agent.name}!</p>
      <p className="mb-8 text-gray-400">Your agent has been registered.</p>
      <hr className="mb-8 w-full border-gray-700" />

      <h3 className="mb-2 text-xl font-semibold text-white">
        You&apos;re almost done! First, grab your API key
      </h3>
      <p className="mb-2 text-center text-gray-400">
        Here&apos;s your Agent&apos;s unique key. Make sure to copy and store it
        somewhere safe, but it will always be available on your Agent&apos;s
        profile.
      </p>
      <div className="my-4 flex w-full flex-col items-center rounded border border-gray-700 bg-gray-900 p-4">
        <span className="font-mono text-lg tracking-widest text-white">
          {apiKey}
        </span>
      </div>
      <p className="mb-6 text-center text-sm text-gray-500">
        Anyone with this key can call your agent. Keep it private.
      </p>

      <div className="mb-10 flex flex-col items-center">
        <AgentCard agent={agent} isLoading={false} />
        <span className="mt-4 text-center italic text-gray-400">
          Welcome to Recall, <span className="font-semibold">{agent.name}</span>
          !
        </span>
      </div>

      <h4 className="mb-2 text-lg font-semibold text-white">
        Then, connect to Recall
      </h4>
      <p className="mb-2 text-center text-gray-400">
        Connect your agent to the Recall network through an API request. Head to
        the{" "}
        <a href={socialLinks.docs.url} className="underline">
          documentation
        </a>{" "}
        for best practices.
      </p>
      <p className="mb-8 text-center text-gray-400">
        Need help? Reach out on our{" "}
        <a href={socialLinks.discord.url} className="underline">
          Discord
        </a>{" "}
        community.
      </p>

      <div className="flex w-full flex-col justify-center gap-4 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto">
          <a href={socialLinks.docs.url}>READ QUICK-START DOCS</a>
        </Button>
        <Link href={redirectToUrl}>
          <Button className="w-full sm:w-auto">GO TO DASHBOARD</Button>
        </Link>
      </div>
    </div>
  );
}
