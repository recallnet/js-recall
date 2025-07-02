import { useCopyToClipboard } from "@uidotdev/usehooks";
import {
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Tooltip } from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { useApiKey, useSandboxApiKey } from "@/hooks/useApiKey";
import { Agent } from "@/types";

export const AgentInfo = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [showKeys, setShowApiKey] = useState({ prod: true, sandbox: true });
  const { data: apiKey, isLoading } = useApiKey(agent.id);
  // WE DONT HAVE SANDBOX API KEY YET, so we hide it
  const { data: sandboxApiKey } = useSandboxApiKey(agent.id);
  const handleShowKey = (type: "prod" | "sandbox") => () => {
    setShowApiKey((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const handleCopy = (type: "prod" | "sandbox") => () => {
    if (type === "prod") copyToClipboard(apiKey?.apiKey || "");
    else copyToClipboard(sandboxApiKey?.apiKey || "");

    setTimeout(() => copyToClipboard(""), 1500);
  };

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3 border p-6",
        className,
      )}
    >
      <div className="mb-5 flex w-full items-center justify-between">
        <span className="text-secondary-foreground w-full text-left text-xs font-semibold uppercase">
          CREDENTIALS
        </span>
        <Link
          href="https://docs.recall.network"
          className="flex items-center gap-1"
        >
          <span className="text-primary-foreground w-full text-left text-xs font-semibold underline">
            Docs
          </span>
          <ExternalLinkIcon />
        </Link>
      </div>
      <div className="xs:grid-cols-[30px_200px_1fr_80px] xs:grid-rows-1 grid w-full grid-cols-[30px_1fr_80px] grid-rows-2 gap-x-3 gap-y-3">
        <Tooltip content="Agent API Key">
          <KeyRoundIcon />
        </Tooltip>
        <span className="text-secondary-foreground xs:col-span-1 col-span-2">
          Production API Key
        </span>
        <span className="text-primary-foreground xs:col-span-1 col-span-2 flex-grow truncate">
          {showKeys.prod && !isLoading
            ? apiKey?.apiKey
            : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
        </span>

        <div className="flex items-center gap-5">
          {showKeys.prod ? (
            <Tooltip content={"Hide"}>
              <EyeIcon
                className="flex-shrink-0 cursor-pointer"
                onClick={handleShowKey("prod")}
              />
            </Tooltip>
          ) : (
            <Tooltip content={"Show"}>
              <EyeOffIcon
                className="flex-shrink-0 cursor-pointer"
                onClick={handleShowKey("prod")}
              />
            </Tooltip>
          )}
          <Tooltip content={copiedText === apiKey?.apiKey ? "Copied!" : "Copy"}>
            <CopyIcon
              className="h-5 w-5 flex-shrink-0 cursor-pointer"
              onClick={handleCopy("prod")}
            />
          </Tooltip>
        </div>
      </div>

      {
        //SANDBOX. TODO
      }
      {
        //<div className="w-full grid grid-cols-[30px_1fr_80px] xs:grid-cols-[30px_200px_1fr_80px] xs:grid-rows-1 grid-rows-2 gap-y-3 gap-x-3">
        //<Tooltip content="Agent API Key">
        //<KeyRoundIcon />
        //</Tooltip>
        //<span className="text-secondary-foreground col-span-2 xs:col-span-1">Sandbox API Key</span>
        //<span className="text-primary-foreground flex-grow truncate col-span-2 xs:col-span-1">
        //{showKeys.sandbox && !isLoadingSandbox ? (
        //sandboxApiKey?.apiKey
        //) : (
        //"••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
        //)}
        //</span>
        //<div className="flex gap-5 items-center">
        //{showKeys.sandbox ? (
        //<Tooltip content={"Hide"}>
        //<EyeIcon
        //className="flex-shrink-0 cursor-pointer"
        //onClick={handleShowKey('sandbox')}
        ///>
        //</Tooltip>
        //) : (
        //<Tooltip content={"Show"}>
        //<EyeOffIcon
        //className="flex-shrink-0 cursor-pointer"
        //onClick={handleShowKey('sandbox')}
        ///>
        //</Tooltip>
        //)}
        //<Tooltip content={copiedText === apiKey?.apiKey ? "Copied!" : "Copy"}>
        //<CopyIcon
        //className="flex-shrink-0 cursor-pointer h-5 w-5"
        //onClick={handleCopy('sandbox')}
        ///>
        //</Tooltip>
        //</div>
        //</div>
      }
    </div>
  );
};

export default AgentInfo;
