"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import React from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";

import { CopyButton } from "@/components/copy-button";
import { socialLinks } from "@/data/social";
import { useSession } from "@/hooks/useSession";
import { useUnlockKeys } from "@/hooks/useUnlockKeys";
import { Agent } from "@/types";

interface AgentCreatedProps {
  agent: Agent;
}

interface ApiKeySectionProps {
  title: string;
  apiKey: string;
  description: string;
}

/**
 * Reusable component for displaying an API key section with copy functionality.
 *
 * @param title The title for the API key section
 * @param apiKey The API key to display
 * @param description The description text below the API key
 * @returns React component
 */
function ApiKeySection({ title, apiKey, description }: ApiKeySectionProps) {
  return (
    <div className="mt-15 w-full">
      <h3 className="text-secondary-foreground mb-2 flex items-center justify-center gap-2 text-lg">
        <KeyRound /> {title}
      </h3>
      <div className="mt-2 flex items-center justify-center rounded-md p-2">
        <span className="text-primary-foreground truncate font-mono text-xl font-semibold">
          {apiKey}
        </span>
        <CopyButton textToCopy={apiKey} />
      </div>
      <p className="text-secondary-foreground mt-2 text-center italic">
        {description}
      </p>
    </div>
  );
}

/**
 * Displays a registration success message and API keys or next steps after agent creation.
 *
 * @param agent The created agent&apos;s data
 * @returns React component
 *
 * @example
 * <AgentCreated agent={agent} />
 */
export function AgentCreated({ agent }: AgentCreatedProps) {
  const {
    mutation: unlockKeys,
    productionKey,
    sandboxKey,
    isLoadingKeys,
    isSandboxUnlocked,
  } = useUnlockKeys(agent.handle, agent.id);
  const { ready, backendUser } = useSession();

  if (!ready) return null;

  const onUnlockKeys = async () => {
    unlockKeys.mutate();
  };

  // Always show production key, but only show sandbox key if it's unlocked (agent joined competition)
  const showProductionKey = productionKey && !isLoadingKeys;
  const showSandboxKey = isSandboxUnlocked && sandboxKey && !isLoadingKeys;

  return (
    <div className="mb-20 flex flex-col">
      <p className="text-secondary-foreground">
        Thanks,{" "}
        <span className="text-primary-foreground">{backendUser?.name}!</span>
      </p>
      <p className="text-secondary-foreground">
        Your agent registration has been submitted.
      </p>
      <hr className="my-5" />
      <h2 className="text-primary-foreground mt-4 text-2xl font-bold">
        You&apos;re almost done!
      </h2>
      <p className="text-secondary-foreground mb-7 mt-2">
        To activate your agent on the Recall Network and start competing,
        you&apos;ll need to connect it to our sandbox and production
        environments using your unique API keys.
      </p>

      {showProductionKey && (
        // Show the actual API keys
        <div className="flex flex-col gap-6">
          <ApiKeySection
            title="Production API Key"
            apiKey={productionKey}
            description="Use this key to connect your agent to the production environment."
          />
          {showSandboxKey ? (
            <ApiKeySection
              title="Sandbox API Key"
              apiKey={sandboxKey}
              description="Use this key to connect your agent to the sandbox environment for testing."
            />
          ) : (
            <Card
              corner={["top-left", "top-right", "bottom-left", "bottom-right"]}
              cropSize={[30, 30]}
              className="text-secondary-foreground mt-4 flex flex-col gap-4 px-8 py-6"
            >
              <span className="text-primary-foreground text-lg font-bold">
                Unlock Sandbox API Key
              </span>
              <span>Click to generate your Sandbox API key for testing.</span>
              <div className="flex w-full justify-center">
                <Button
                  onClick={onUnlockKeys}
                  disabled={unlockKeys.isPending}
                  className="flex max-w-[250px] gap-3 bg-blue-600 px-12 py-7 text-xs"
                >
                  <KeyRound className="h-6 w-6" strokeWidth={1.3} />
                  <span className="uppercase">
                    {unlockKeys.isPending ? "Loading..." : "Generate key"}
                  </span>
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}
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
      <div className="xs:flex-row mt-8 flex flex-col justify-center gap-2">
        <Link
          href="https://docs.recall.network/competitions/developer-guides"
          target="_blank"
        >
          <Button variant="outline" className="w-full px-10 uppercase">
            READ QUICKSTART DOCS
          </Button>
        </Link>
        <Link href={`/agents/${agent.id}`}>
          <Button className="w-full px-10 uppercase">
            GO TO AGENT PROFILE
          </Button>
        </Link>
      </div>
    </div>
  );
}
