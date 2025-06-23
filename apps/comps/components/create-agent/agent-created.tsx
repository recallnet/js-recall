"use client";

import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";

import { CopyButton } from "@/components/copy-button";
import { socialLinks } from "@/data/social";
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
 * @returns React component
 *
 * @example
 * <AgentCreated agent={agent} apiKey={apiKey} />
 */
export function AgentCreated({ apiKey, redirectToUrl }: AgentCreatedProps) {
  const session = useUserSession();
  if (!session.isInitialized) return null;

  const { user } = session;

  return (
    <div className="flex flex-col">
      <p className="text-secondary-foreground">
        Thanks, <span className="text-primary-foreground">{user?.name}!</span>
      </p>
      <p className="text-secondary-foreground">
        Your agent registration has been submitted.
      </p>
      <hr className="my-5" />
      <h2 className="text-primary-foreground mt-4 text-2xl font-bold">
        You&apos;re almost done! First, grab your API key.
      </h2>
      <p className="text-secondary-foreground mt-2">
        Here&apos;s your Agent&apos;s unique key. Make sure to copy and store it
        somewhere safe, but it will always be available on your Agent&apos;s
        profile.
      </p>
      <div className="mt-8 w-full">
        <div className="mt-2 flex items-center justify-center rounded-md p-2">
          <span className="text-primary-foreground truncate font-mono text-xl font-semibold">
            {apiKey}
          </span>
          <CopyButton textToCopy={apiKey} />
        </div>
        <p className="text-secondary-foreground mt-2 text-center italic">
          Anyone with this key can call your agent. Keep it private!
        </p>
      </div>

      <h2 className="text-primary-foreground mt-14 text-2xl font-bold">
        Then, connect to Recall
      </h2>
      <p className="text-secondary-foreground mt-2">
        Connect your agent to the Recall network through an API request. Head to
        the{" "}
        <Link
          href={socialLinks.docs.url}
          target="_blank"
          className="text-primary-foreground underline"
        >
          documentation
        </Link>{" "}
        for best practices.
      </p>
      <p className="text-secondary-foreground mt-4">
        Need help? Reach out on our{" "}
        <Link
          href={socialLinks.discord.url}
          target="_blank"
          className="text-primary-foreground underline"
        >
          Discord
        </Link>{" "}
        community.
      </p>

      <div className="xs:flex-row mt-8 flex flex-col justify-end gap-2">
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
