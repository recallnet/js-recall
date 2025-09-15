import { KeyRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@recallnet/ui2/components/button";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { useUnlockKeys } from "@/hooks/useUnlockKeys";
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
  isLocked,
  onUnlock,
  isUnlocking,
}: {
  label: string;
  tooltip: string;
  apiKey?: string;
  isLoading: boolean;
  isLocked?: boolean;
  onUnlock?: () => void;
  isUnlocking?: boolean;
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
      {isLocked && onUnlock ? (
        <div className="flex flex-grow items-center gap-4">
          <span className="text-secondary-foreground text-sm">
            Click to unlock your API key
          </span>
          <Button
            onClick={onUnlock}
            disabled={isUnlocking}
            className="ml-auto flex gap-2 bg-blue-600 px-6 py-2 text-xs"
          >
            <KeyRound className="h-4 w-4" strokeWidth={1.3} />
            <span>{isUnlocking ? "Loading..." : "Unlock"}</span>
          </Button>
        </div>
      ) : (
        <>
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
        </>
      )}
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
  const { productionKey, sandboxKey, isLoadingKeys, isUnlocked, mutation } =
    useUnlockKeys(agent.handle, agent.id);

  const unlockKeys = () => {
    mutation.mutate();
  };

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
      {/* Show loading state if keys are still loading */}
      {isLoadingKeys ? (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <>
          <ApiKeyRow
            label="Production API Key"
            tooltip="Agent API Key"
            apiKey={productionKey}
            isLoading={isLoadingKeys}
          />
          <ApiKeyRow
            label="Sandbox API Key"
            tooltip="Sandbox Agent API Key"
            apiKey={sandboxKey}
            isLoading={isLoadingKeys}
            isLocked={!isUnlocked}
            onUnlock={unlockKeys}
            isUnlocking={mutation.isPending}
          />
        </>
      )}
    </div>
  );
};

export default Credentials;
