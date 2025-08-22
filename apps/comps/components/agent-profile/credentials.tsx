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
  unlockKeysMutation,
}: {
  unlockKeysMutation: ReturnType<typeof useUnlockKeys>["mutation"];
}) => {
  const unlockKeys = async () => {
    unlockKeysMutation.mutate();
  };

  const button = (
    <Button
      onClick={unlockKeys}
      disabled={unlockKeysMutation.isPending}
      className="flex gap-3 bg-blue-600 px-12 py-7 text-xs"
    >
      <KeyRound className="h-6 w-6 uppercase" strokeWidth={1.3} />
      <span>{unlockKeysMutation.isPending ? "Loading..." : "Unlock keys"}</span>
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
          <span className="ml-1 text-red-500">locked</span>.
        </span>
      </div>

      <div className="text-center sm:text-left">
        <span className="text-secondary-foreground text-sm">
          Click below to unlock your Production and Sandbox API keys.
        </span>
      </div>

      <div className="flex justify-center sm:justify-end">{button}</div>
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
    useUnlockKeys(agent.name, agent.id);

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
      ) : isUnlocked ? (
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
        <ApiKeyLocked unlockKeysMutation={mutation} />
      )}
    </div>
  );
};

export default Credentials;
