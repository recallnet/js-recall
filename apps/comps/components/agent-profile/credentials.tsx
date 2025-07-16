import {KeyRound, Mail} from "lucide-react";
import {useState} from "react";

import {Tooltip} from "@recallnet/ui2/components/tooltip";
import {toast} from "@recallnet/ui2/components/toast";
import {Button} from "@recallnet/ui2/components/button";
import {cn} from "@recallnet/ui2/lib/utils";

import {useApiKey} from "@/hooks/useApiKey";
import {useSandboxAgentApiKey} from "@/hooks/useSandbox";
import {Agent} from "@/types";

import {CopyButton} from "../copy-button";
import {VisibilityToggle} from "../visibility-toggle";
import {useProfile} from "@/hooks/useProfile";
import {useVerifyEmail} from "@/hooks/useVerifyEmail";
import {useUnlockKeys} from "@/hooks/useUnlockKeys";

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

const ApiKeyLocked = () => {
  const {mutate: verifyEmail, isPending} = useVerifyEmail();
  const {mutation: registerAgentSandbox} = useUnlockKeys('')
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);
  const [isLocked, setIsLocked] = useState(true)

  const unlockKeys = async () => {
    toast.success(
      "API Keys unlocked successfully"
    );
    registerAgentSandbox.mutate()
    setIsLocked(false)
  }

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

  const button = (
    <Button
      onClick={isLocked ? unlockKeys : onSendEmail}
      disabled={isPending || emailVerifyClicked}
      className='bg-blue-600 py-7 px-12 text-xs flex gap-3'
    >
      {
        isLocked ?
          <>
            <KeyRound className="w-6 h-6 uppercase" strokeWidth={1.3} />
            <span>Unlock keys</span>
          </>
          :
          <>
            <Mail className="w-6 h-6" strokeWidth={1.3} />
            <span>Verify EMAIL</span>
          </>
      }
    </Button>
  )


  return (
    <div className="w-full grid grid-cols-1 sm:grid-cols-[30px_200px_1fr_300px] gap-4 items-center">
      <div className="flex items-center justify-center w-8 mx-auto md:mx-0">
        <KeyRound className="w-7 h-7 text-gray-500" strokeWidth={1.3} />
      </div>

      <div className="text-center sm:text-left">
        <span className="text-sm font-bold block text-secondary-foreground">
          Your API keys are
          <span className="text-red-300 ml-1">locked</span>
          .
        </span>
      </div>

      <div className="text-center sm:text-left">
        {
          !isLocked &&
          <span className="text-sm text-secondary-foreground">
            To access Production and Sandbox API keys, verify your email.
            Once verified, you can unlock them.
          </span>
        }
      </div>

      <div className="flex justify-center sm:justify-end">
        {emailVerifyClicked ? (
          <Tooltip content='You can only send a verification each 60 seconds'>
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
  const {data: user} = useProfile()
  const {data: apiKey, isLoading} = useApiKey(agent.id);
  const {data: sandboxApiKey, isLoading: sandboxLoading} =
    useSandboxAgentApiKey(agent.name);
  const isEmailVerified = user && user.isEmailVerified

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
      {isEmailVerified && false ?
        <>
          <ApiKeyRow
            label="Production API Key"
            tooltip="Agent API Key"
            apiKey={apiKey?.apiKey}
            isLoading={isLoading}
          />
          {sandboxApiKey && (
            <ApiKeyRow
              label="Sandbox API Key"
              tooltip="Sandbox Agent API Key"
              apiKey={sandboxApiKey?.agent.apiKey}
              isLoading={sandboxLoading}
            />
          )}
        </>
        :
        <ApiKeyLocked />
      }
    </div>
  );
};

export default Credentials;
