import { KeyRound, Mail } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { toast } from "@recallnet/ui2/components/toast";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { useProfile } from "@/hooks/useProfile";
import { useUnlockKeys } from "@/hooks/useUnlockKeys";
import { useVerifyEmail } from "@/hooks/useVerifyEmail";
import { Agent } from "@/types";

import { CopyButton } from "../copy-button";
import { VisibilityToggle } from "../visibility-toggle";

/**
 * Component for displaying an API key row with visibility toggle and copy functionality
 */
const ApiKeyRow = ({
  label,
  tooltip,
  apiKey,
  isLoading,
}: {
  label: string;
  tooltip: string;
  apiKey?: string;
  isLoading: boolean;
}) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="flex w-full items-center gap-4 overflow-hidden">
      <div className="flex min-w-[200px] items-center gap-2">
        <Tooltip content={tooltip}>
          <KeyRound />
        </Tooltip>
        <span className="text-sm">{label}</span>
      </div>
      {isVisible || isLoading ? (
        <span className="text-primary-foreground flex-grow truncate">
          {apiKey}
        </span>
      ) : (
        <span className="text-primary-foreground flex-grow truncate">
          ••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••
        </span>
      )}
      <VisibilityToggle
        isVisible={isVisible}
        onToggle={() => setIsVisible(!isVisible)}
      />
      <CopyButton textToCopy={apiKey || ""} />
    </div>
  );
};

const ApiKeyLocked = ({
  agent,
  isEmailVerified,
  unlockKeysMutation,
}: {
  agent: Agent;
  isEmailVerified: boolean;
  unlockKeysMutation: ReturnType<typeof useUnlockKeys>["mutation"];
}) => {
  const { mutate: verifyEmail, isPending } = useVerifyEmail();
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);

  const unlockKeys = async () => {
    unlockKeysMutation.mutate();
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

  const button = (
    <Button
      onClick={isEmailVerified ? unlockKeys : onSendEmail}
      disabled={isPending || emailVerifyClicked}
      className="flex gap-3 bg-blue-600 px-12 py-7 text-xs"
    >
      {isEmailVerified ? (
        <>
          <KeyRound className="h-6 w-6 uppercase" strokeWidth={1.3} />
          <span>Unlock keys</span>
        </>
      ) : (
        <>
          <Mail className="h-6 w-6" strokeWidth={1.3} />
          <span>Verify EMAIL</span>
        </>
      )}
    </Button>
  );

  return (
    <div className="grid w-full grid-cols-1 items-center gap-4 sm:grid-cols-[30px_200px_1fr_300px]">
      <div className="mx-auto flex w-8 items-center justify-center md:mx-0">
        <KeyRound className="h-7 w-7 text-gray-500" strokeWidth={1.3} />
      </div>

      <div className="text-center sm:text-left">
        <span className="text-secondary-foreground block text-sm font-bold">
          Your API keys are
          <span className="ml-1 text-red-300">locked</span>.
        </span>
      </div>

      <div className="text-center sm:text-left">
        {!isEmailVerified && (
          <span className="text-secondary-foreground text-sm">
            To access Production and Sandbox API keys, verify your email. Once
            verified, you can unlock them.
          </span>
        )}
      </div>

      <div className="flex justify-center sm:justify-end">
        {emailVerifyClicked ? (
          <Tooltip content="You can only send a verification each 60 seconds">
            {button}
          </Tooltip>
        ) : (
          button
        )}
      </div>
    </div>
  );
};

export const Credentials = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  const { data: user } = useProfile();
  const { productionKey, sandboxKey, isLoadingKeys, isUnlocked, mutation } =
    useUnlockKeys(agent.name, agent.id);
  const isEmailVerified = user && user.isEmailVerified;

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
      {isEmailVerified && isUnlocked ? (
        <>
          <ApiKeyRow
            label="Production API Key"
            tooltip="Agent API Key"
            apiKey={productionKey}
            isLoading={isLoadingKeys}
          />
          {sandboxKey && (
            <ApiKeyRow
              label="Sandbox API Key"
              tooltip="Sandbox Agent API Key"
              apiKey={sandboxKey}
              isLoading={isLoadingKeys}
            />
          )}
        </>
      ) : (
        <ApiKeyLocked
          agent={agent}
          isEmailVerified={!!isEmailVerified}
          unlockKeysMutation={mutation}
        />
      )}
    </div>
  );
};

export default Credentials;
