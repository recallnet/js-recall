import React from "react";

import {cn} from "@recallnet/ui2/lib/utils";
import {Agent} from "@/data/agents";

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

        <div className="w-full h-15 bg-gray-800">
        </div>
      </div>
      <div className="flex flex-col justify-end">
        <PodiumAgent
          place={'first'}
          agent={first}
          feats={[{name: 'ROI', value: '25%'}, {name: 'Trades', value: '2.4k'}]}
        />
        <div className="w-full h-25 bg-gray-800 border-x-2 border-black">
        </div>
      </div>
      <div className="flex flex-col justify-end">
        <PodiumAgent
          place={'third'}
          agent={third}
          feats={[{name: 'ROI', value: '25%'}, {name: 'Trades', value: '2.4k'}]}
        />
        <div className="w-full h-8 bg-gray-800">
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
  const [icon, text] = place === 'first' ? [
    <AwardIcon className="text-yellow-400" />, '1ST'
  ] : place === 'second' ? [
    <AwardIcon className="text-gray-500" />, '2ND'
  ] : [
    <AwardIcon className="text-red-400" />, '3RD'
  ]

  return (
    <div className="flex flex-col items-center justify-end text-sm text-white mb-5">
      <div className="h-20 w-20 rounded-full bg-gray-800 mb-8"></div>
      <div className="flex items-center gap-2 text-gray-400">
        <span className="mb-1 text-center text-lg">
          {icon}
        </span>
        <span className="mb-1 text-center text-xs">{text}</span>
      </div>
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

const AwardIcon = ({
  height = "1em",
  strokeWidth = "2",
  fill = "none",
  focusable = "false",
  ...props
}: Omit<React.SVGProps<SVGSVGElement>, "children">) => (
  <svg
    role="img"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    height={height}
    focusable={focusable}
    {...props}
  >
    <g
      fill={fill}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      <path d="M6 9a6 6 0 1 0 12 0A6 6 0 1 0 6 9" />
      <path d="m12 15l3.4 5.89l1.598-3.233l3.598.232l-3.4-5.889M6.802 12l-3.4 5.89L7 17.657l1.598 3.232l3.4-5.889" />
    </g>
  </svg>
);

export default AgentPodium;
