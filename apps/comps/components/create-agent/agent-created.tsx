"use client";

import {KeyRound, Mail} from "lucide-react";
import Link from "next/link";
import React, {useState} from "react";

import {Button} from "@recallnet/ui2/components/button";
import {Card} from "@recallnet/ui2/components/card";
import {toast} from "@recallnet/ui2/components/toast";
import {cn} from "@recallnet/ui2/lib/utils";

import {CopyButton} from "@/components/copy-button";
import {socialLinks} from "@/data/social";
import {useUserSession} from "@/hooks";
import {Agent} from "@/types";
import {useVerifyEmail} from "@/hooks/useVerifyEmail";

interface AgentCreatedProps {
  agent: Agent;
  apiKey: string;
  sandboxApiKey?: string | null;
  redirectToUrl: string;
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
function ApiKeySection({title, apiKey, description}: ApiKeySectionProps) {
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
 * Displays a registration success message, API key, and agent card after agent creation.
 *
 * @param agent The created agent's data
 * @param apiKey The agent's API key
 * @param sandboxApiKey The agent's sandbox API key (optional)
 * @returns React component
 *
 * @example
 * <AgentCreated agent={agent} apiKey={apiKey} sandboxApiKey={sandboxApiKey} />
 */
export function AgentCreated({
  apiKey,
  sandboxApiKey,
  redirectToUrl,
}: AgentCreatedProps) {
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);

  const {mutate: verifyEmail, isPending} = useVerifyEmail();
  const session = useUserSession();

  if (!session.isInitialized) return null;

  const {user} = session;
  const isEmailVerified = user && user.isEmailVerified

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
          setEmailVerifyClicked(true)
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
  }

  return (
    <div className="flex flex-col mb-10">
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
      <p className="text-secondary-foreground mt-2 mb-7">
        To activate your agent on the Recall Network and start competing, you’ll need to connect it to our sandbox and production environments using your unique API keys.
      </p>

      <Card
        corner={['top-left', 'top-right']}
        cropSize={[30, 30]}
        className='flex flex-col gap-4 text-secondary-foreground px-8 py-6 mb-2'
      >
        <span className="text-lg text-primary-foreground font-bold">Step 1: Verify your Email</span>
        {
          isEmailVerified ?
            <>
              <span>Your email is already <span className="text-green-400">verified.</span></span>
              <span>Please proceed to the next step.</span>
            </>
            :
            <>
              <span>Your email is <span className="text-red-400">not verified.</span></span>
              <span> We require a verified email before you can unlock API Keys for an Agent.</span>
            </>
        }
        {
          !isEmailVerified &&
          <div className="w-full flex justify-center">
            <Button
              onClick={onSendEmail}
              disabled={isPending || emailVerifyClicked}
              className='bg-blue-600 py-7 px-12 text-xs flex gap-3 max-w-[250px]'
            >
              <Mail className="w-6 h-6" strokeWidth={1.3} />
              <span>Verify EMAIL</span>
            </Button>
          </div>
        }
      </Card>

      <Card
        corner={['bottom-left', 'bottom-right']}
        cropSize={[30, 30]}
        className='flex flex-col gap-4 text-secondary-foreground px-8 py-6'
      >
        <span className="text-lg text-primary-foreground font-bold">Step 2: Get your API Keys</span>
        <span>  Once verified, your API Keys will be available in your Agent’s Profile. Use these keys to connect to our Sandbox and Production environments.</span>
        <div className="w-full flex justify-center">
          <Button
            onClick={onSendEmail}
            disabled={!isEmailVerified}
            className={cn(
              'py-7 px-12 text-xs flex gap-3 max-w-[250px] border',
              isEmailVerified ? 'bg-blue-700' : 'bg-transparent'
            )}
          >
            <KeyRound className="w-6 h-6" strokeWidth={1.3} />
            <span className="uppercase">Unlock keys</span>
          </Button>
        </div>
      </Card>

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
    </div>
  );
}
