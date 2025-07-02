import {useCopyToClipboard} from "@uidotdev/usehooks";
import {
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
} from "lucide-react";
import {useState} from "react";

import {Tooltip} from "@recallnet/ui2/components/tooltip";
import {cn} from "@recallnet/ui2/lib/utils";

import {Agent} from "@/types";
import {useApiKey, useSandboxApiKey} from "@/hooks/useApiKey";
import Link from "next/link";

export const AgentInfo = ({
  agent,
  className,
}: {
  agent: Agent;
  className?: string;
}) => {
  const [copiedText, copyToClipboard] = useCopyToClipboard();
  const [showKeys, setShowApiKey] = useState({prod: true, sandbox: true});
  const {data: apiKey, isLoading} = useApiKey(agent.id);
  // WE DONT HAVE SANDBOX API KEY YET, so we hide it
  const {data: sandboxApiKey, isLoading: isLoadingSandbox} = useSandboxApiKey(agent.id);
  const handleShowKey = (type: 'prod' | 'sandbox') => () => {
    setShowApiKey(prev => ({...prev, [type]: !prev[type]}))
  }

  const handleCopy = (type: 'prod' | 'sandbox') => () => {
    if (type === 'prod')
      copyToClipboard(apiKey?.apiKey || '');
    else
      copyToClipboard(sandboxApiKey?.apiKey || '');

    setTimeout(() => copyToClipboard(""), 1500);
  };

  return (
    <div
      className={cn(
        "text-secondary-foreground flex w-full flex-col justify-center gap-3 border p-6",
        className,
      )}
    >
      <div className="flex justify-between items-center w-full mb-5">
        <span className="uppercase text-secondary-foreground text-xs text-left w-full font-semibold ">CREDENTIALS</span>
        <Link href='https://docs.recall.network' className="flex gap-1 items-center">
          <span className="underline text-primary-foreground text-xs text-left w-full font-semibold">Docs</span>
          <ExternalLinkIcon />
        </Link>
      </div>
      <div className="w-full grid grid-cols-[30px_1fr_80px] xs:grid-cols-[30px_200px_1fr_80px] xs:grid-rows-1 grid-rows-2 gap-y-3 gap-x-3">
        <Tooltip content="Agent API Key">
          <KeyRoundIcon />
        </Tooltip>
        <span className="text-secondary-foreground col-span-2 xs:col-span-1">Production API Key</span>
        <span className="text-primary-foreground flex-grow truncate col-span-2 xs:col-span-1">
          {showKeys.prod && !isLoading ? (
            apiKey?.apiKey
          ) : (
            "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"
          )}
        </span>

        <div className="flex gap-5 items-center">
          {showKeys.prod ? (
            <Tooltip content={"Hide"}>
              <EyeIcon
                className="flex-shrink-0 cursor-pointer"
                onClick={handleShowKey('prod')}
              />
            </Tooltip>
          ) : (
            <Tooltip content={"Show"}>
              <EyeOffIcon
                className="flex-shrink-0 cursor-pointer"
                onClick={handleShowKey('prod')}
              />
            </Tooltip>
          )}
          <Tooltip content={copiedText === apiKey?.apiKey ? "Copied!" : "Copy"}>
            <CopyIcon
              className="flex-shrink-0 cursor-pointer h-5 w-5"
              onClick={handleCopy('prod')}
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
