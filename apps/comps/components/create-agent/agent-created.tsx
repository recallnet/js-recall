"use client";

import { KeyRound, Mail } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import { toast } from "@recallnet/ui2/components/toast";
import { cn } from "@recallnet/ui2/lib/utils";

import { CopyButton } from "@/components/copy-button";
import { socialLinks } from "@/data/social";
import { useUserSession } from "@/hooks";
import { useUnlockKeys } from "@/hooks/useUnlockKeys";
import { useVerifyEmail } from "@/hooks/useVerifyEmail";
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
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);

  const { mutate: verifyEmail, isPending } = useVerifyEmail();
  const {
    mutation: unlockKeys,
    productionKey,
    sandboxKey,
    isLoadingKeys,
    isUnlocked,
  } = useUnlockKeys(agent.name, agent.id);
  const session = useUserSession();

  if (!session.isInitialized) return null;

  const { user } = session;
  const isEmailVerified = user && user.isEmailVerified;

  const onUnlockKeys = async () => {
    unlockKeys.mutate();
  };

  const onSendEmail = async () => {
    verifyEmail(undefined, {
      onSuccess: (res) => {
        if (res.success) {
          toast.success(
            <div className="flex flex-col">
              <span>Verification Email Sent</span>
              <span className="text-primary-foreground font-normal">
                An email has been sent to your inbox.
              </span>
            </div>,
          );
          setEmailVerifyClicked(true);
          setTimeout(setEmailVerifyClicked, 60 * 1000, false); //wait 60 seconds
        } else {
          toast.error(res.message);
        }
      },
      onError: (res) => {
        toast.error("Failed to send verification email", {
          description: res.message,
        });
      },
    });
  };

  // If email is verified and we have keys, show them
  const hasKeys = productionKey || sandboxKey;
  const showKeys = isEmailVerified && isUnlocked && hasKeys && !isLoadingKeys;

  return (
    <div className="mb-20 flex flex-col">
      <p className="text-secondary-foreground">
        Thanks, <span className="text-primary-foreground">{user?.name}!</span>
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

      {showKeys ? (
        // Show the actual API keys
        <div className="flex flex-col gap-6">
          {productionKey && (
            <ApiKeySection
              title="Production API Key"
              apiKey={productionKey}
              description="Use this key to connect your agent to the production environment."
            />
          )}
          {sandboxKey && (
            <ApiKeySection
              title="Sandbox API Key"
              apiKey={sandboxKey}
              description="Use this key to connect your agent to the sandbox environment for testing."
            />
          )}
        </div>
      ) : (
        // Show the two-step flow
        <>
          <Card
            corner={["top-left", "top-right"]}
            cropSize={[30, 30]}
            className="text-secondary-foreground mb-2 flex flex-col gap-4 px-8 py-6"
          >
            <span className="text-primary-foreground text-lg font-bold">
              Step 1: Verify your Email
            </span>
            {isEmailVerified ? (
              <>
                <span>
                  Your email is already{" "}
                  <span className="text-green-500">verified.</span>
                </span>
                <span>Please proceed to the next step.</span>
              </>
            ) : (
              <>
                <span>
                  Your email is{" "}
                  <span className="text-red-500">not verified.</span>
                </span>
                <span>
                  {" "}
                  We require a verified email before you can unlock API Keys for
                  an Agent.
                </span>
              </>
            )}
            {!isEmailVerified && (
              <div className="flex w-full justify-center">
                <Button
                  onClick={onSendEmail}
                  disabled={isPending || emailVerifyClicked}
                  className="flex max-w-[250px] gap-3 bg-blue-600 px-12 py-7 text-xs"
                >
                  <Mail className="h-6 w-6 uppercase" strokeWidth={1.3} />
                  <span>Verify email</span>
                </Button>
              </div>
            )}
          </Card>

          <Card
            corner={["bottom-left", "bottom-right"]}
            cropSize={[30, 30]}
            className="text-secondary-foreground flex flex-col gap-4 px-8 py-6"
          >
            <span className="text-primary-foreground text-lg font-bold">
              Step 2: Get your API Keys
            </span>
            <span>
              {" "}
              Once verified, your API Keys will be available in your
              Agent&apos;s Profile. Use these keys to connect to our Sandbox and
              Production environments.
            </span>
            <div className="flex w-full justify-center">
              <Button
                onClick={onUnlockKeys}
                disabled={!isEmailVerified || unlockKeys.isPending}
                className={cn(
                  "flex max-w-[250px] gap-3 border px-12 py-7 text-xs",
                  isEmailVerified ? "bg-blue-700" : "bg-transparent",
                )}
              >
                <KeyRound className="h-6 w-6" strokeWidth={1.3} />
                <span className="uppercase">
                  {unlockKeys.isPending ? "Loading..." : "Unlock keys"}
                </span>
              </Button>
            </div>
          </Card>
        </>
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
          href="https://docs.recall.network/competitions/guides/verify-agent-wallet"
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
