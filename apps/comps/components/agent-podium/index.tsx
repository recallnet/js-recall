import React from "react";

import { cn } from "@/../../packages/ui2/src/lib/utils";
import { Agent } from "@/types";

interface AgentPodiumProps {
  first?: AgentResponse;
  second?: AgentResponse;
  third?: AgentResponse;
  className?: string;
  loaded?: boolean;
}

export const AgentPodium: React.FC<AgentPodiumProps> = ({
  first,
  second,
  third,
  className,
  loaded,
}) => {
  return (
    <div className={cn("grid w-full grid-cols-1 md:grid-cols-3", className)}>
      <div className="order-2 flex flex-col justify-end md:order-1">
        <PodiumAgent
          place={"second"}
          agent={second}
          loaded={loaded}
          feats={[
            { name: "ROI", value: "25%" },
            { name: "Trades", value: "2.4k" },
          ]}
        />

        <div className="h-15 bg-card w-full"></div>
      </div>
      <div className="order-1 flex flex-col justify-end md:order-2">
        <PodiumAgent
          place={"first"}
          agent={first}
          loaded={loaded}
          feats={[
            { name: "ROI", value: "25%" },
            { name: "Trades", value: "2.4k" },
          ]}
        />
        <div className="h-25 bg-card w-full border-x-2 border-black"></div>
      </div>
      <div className="order-3 flex flex-col justify-end">
        <PodiumAgent
          place={"third"}
          agent={third}
          loaded={loaded}
          feats={[
            { name: "ROI", value: "25%" },
            { name: "Trades", value: "2.4k" },
          ]}
        />
        <div className="bg-card h-8 w-full"></div>
      </div>
    </div>
  );
};

type PodiumAgentProps = {
  place: "first" | "second" | "third";
  agent?: AgentResponse;
  loaded?: boolean;
  feats: [{ name: string; value: string }, { name: string; value: string }];
};

const PodiumAgent: React.FunctionComponent<PodiumAgentProps> = ({
  place,
  agent,
  feats,
  loaded,
}) => {
  return (
    <div className="mb-5 flex flex-col items-center justify-end text-sm text-white">
      <div className="mb-5 h-20 w-20 rounded-full">
        {loaded ? (
          <MirrorImage
            width={100}
            height={100}
            image={agent?.imageUrl || "/default_agent.png"}
          />
        ) : (
          <Skeleton className="h-20 w-20 rounded rounded-full" />
        )}
      </div>
      <AwardIcon place={place} />
      <div className="mb-2 flex flex-col items-center text-lg font-bold">
        {loaded ? (
          <span className="capitalize">{agent?.name}</span>
        ) : (
          <Skeleton className="w-15 h-3 rounded-full" />
        )}
      </div>
      <div className="flex justify-around">
        <div className="flex items-center gap-2 border border-gray-800 px-3 py-2">
          {loaded ? <span className="">{feats[0].name}</span> : <Skeleton />}
          {loaded ? (
            <span className="text-gray-500">{feats[0].value}</span>
          ) : (
            <Skeleton />
          )}
        </div>
        <div className="flex items-center gap-2 border border-gray-800 px-3 py-2">
          {loaded ? <span className="">{feats[1].name}</span> : <Skeleton />}
          {loaded ? (
            <span className="text-gray-500">{feats[1].value}</span>
          ) : (
            <Skeleton />
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentPodium;
