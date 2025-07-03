import { KeyRound } from "lucide-react";
import { useState } from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { useAgentApiKey, useSandboxAgentApiKey } from "@/hooks";
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

export const Credentials = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  const { data: apiKey, isLoading } = useAgentApiKey(agent.id);
  const { data: sandboxApiKey, isLoading: sandboxLoading } =
    useSandboxAgentApiKey(agent.name);

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3",
        className,
      )}
    >
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
          apiKey={sandboxApiKey?.agent?.apiKey}
          isLoading={sandboxLoading}
        />
      )}
    </div>
  );
};

export default Credentials;
