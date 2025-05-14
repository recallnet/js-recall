import React from "react";
import Image from "next/image";

import {cn} from "@recallnet/ui2/lib/utils";
import {Agent} from "@/state/types";
import AwardIcon from "./award-icon";

interface AgentPodiumProps {
  first: AgentResponse;
  second: AgentResponse;
  third: AgentResponse;
  className?: string;
}

export const AgentPodium: React.FC<AgentPodiumProps> = ({
  first,
  second,
  third,
  className,
}) => {
  return (
    <div
      className={cn(
        "grid w-full grid-cols-1 md:grid-cols-3",
        className,
      )}
    >
      <div className="flex flex-col justify-end">
        <PodiumAgent
          place={'second'}
          agent={second}
          feats={[{name: 'ROI', value: '25%'}, {name: 'Trades', value: '2.4k'}]}
        />

        <div className="w-full h-15 bg-card">
        </div>
      </div>
      <div className="flex flex-col justify-end">
        <PodiumAgent
          place={'first'}
          agent={first}
          feats={[{name: 'ROI', value: '25%'}, {name: 'Trades', value: '2.4k'}]}
        />
        <div className="w-full h-25 bg-card border-x-2 border-black">
        </div>
      </div>
      <div className="flex flex-col justify-end">
        <PodiumAgent
          place={'third'}
          agent={third}
          feats={[{name: 'ROI', value: '25%'}, {name: 'Trades', value: '2.4k'}]}
        />
        <div className="w-full h-8 bg-card">
        </div>
      </div>
    </div>
  );
};

type PodiumAgentProps = {
  place: 'first' | 'second' | 'third';
  agent: Agent;
  feats: [{name: string; value: string}, {name: string; value: string}]
}

const PodiumAgent: React.FunctionComponent<PodiumAgentProps> = ({place, agent, feats}) => {

  return (
    <div className="flex flex-col items-center justify-end text-sm text-white mb-5">
      <div className="h-20 w-20 rounded-full mb-5">
        <Image
          src={agent.imageUrl || "/default_agent.png"}
          alt="avatar"
          width={100}
          height={100}
        />
        <div
          className="overflow-hidden"
          style={{height: 50}}
        >
          <Image
            src={agent.imageUrl || "/default_agent.png"}
            alt="avatar"
            width={100}
            height={100}
            className="block scale-y-[-1] opacity-40 blur-[3px]"
            style={{
              maskImage:
                "linear-gradient(to top, black 0%, black 10%, transparent 60%, transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to top, black 0%, black 10%, transparent 60%, transparent 100%)",
            }}
          />
        </div>
      </div>
      <AwardIcon place={place} />
      <div className="flex flex-col items-center font-bold mb-2 text-lg">
        <span className="capitalize">{agent.name}</span>
      </div>
      <div className="flex justify-around">
        <div className="flex items-center border border-gray-800 px-3 py-2 gap-2">
          <span className="">{feats[0].name}</span>
          <span className="text-gray-500">{feats[0].value}</span>
        </div>
        <div className="flex items-center border border-gray-800 px-3 py-2 gap-2">
          <span className="">{feats[1].name}</span>
          <span className="text-gray-500">{feats[1].value}</span>
        </div>
      </div>
    </div>
  )
}

export default AgentPodium;
