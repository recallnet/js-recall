"use client";

import React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@recallnet/ui2/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import {cn} from "@recallnet/ui2/lib/utils";

import {useAgent} from "@/hooks/useAgent";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";
import {AgentResponse, CompetitionResponse, CompetitionStatus} from "@/types";
import Card from "@recallnet/ui2/components/shadcn/card";
import MirrorImage from "@/components/mirror-image";
import {Hexagon} from "@/components/hexagon";
import {Breadcrumbs} from "@/components/breadcrumb";
import {ArrowDownUp, Share2Icon} from "lucide-react";

type AgentCompetition = CompetitionResponse & {
  placement: string;
  roi: string;
  trades: number;
  elo: number;
};

export default function AgentProfile({
  id,
}: {
  id: string;
}) {
  const {
    data: agent,
    isLoading: isLoadingAgent,
    error: agentError,
  } = useAgent(id);
  const {data: agentCompetitionsData, isLoading: isLoadingCompetitions} =
    useAgentCompetitions(id);

  // Format competitions data
  const competitions = React.useMemo(() => {
    if (!agentCompetitionsData?.competitions || !agent) return [];

    return agentCompetitionsData.competitions.map((comp) => {
      // Find the agent's status in this competition
      const agentStatus = comp.agentStatus.find(
        (status) => status.agentId === id,
      );

      return {
        ...comp,
        placement: agentStatus
          ? `${agentStatus.position}/${comp.registeredAgents}`
          : "N/A",
        roi:
          agentStatus?.metadata?.roi !== undefined
            ? `${(agentStatus.metadata.roi * 100).toFixed(2)}%`
            : "0.00%",
        trades: agentStatus?.metadata?.trades || 0,
        elo: agent.stats?.eloAvg || 0,
      };
    });
  }, [agentCompetitionsData, agent, id]);

  if (isLoadingAgent || isLoadingCompetitions)
    return <div className="py-20 text-center">Loading agent data...</div>;
  if (agentError || !agent)
    return <div className="py-20 text-center">Agent not found</div>;

  const skills = agent.stats?.provenSkills || [];
  const trophies = agent.trophies || [];

  return (
    <>
      <Breadcrumbs items={[{title: "RECALL", href: "/"}, {title: "AGENTS", href: "/"}, {title: agent.name, href: "/"},]} />

      <div className="my-6 pt-5 grid md:grid-cols-[400px_1fr_1fr] grid-cols-[300px_1fr_1fr] sm:grid-rows-[65vh_1fr] rounded-xl border-t border-gray-700">
        <Card className="sm:col-span-1 col-span-3 flex flex-col items-center justify-between bg-gray-900 h-[65vh] p-8 sm:mr-8" corner="top-left" cropSize={45}>
          <div className="flex justify-end w-full">
            <Share2Icon className="text-gray-600" size={30} />
          </div>
          <MirrorImage
            image={agent.imageUrl || "/agent-image.png"}
            width={160}
            height={160}
          />
          <span className="text-gray-400 text-lg text-center w-50 mt-20">Calm accumulation of elite assets.</span>
        </Card>
        <div className="lg:col-span-1 lg:col-start-2 sm:col-span-2 col-span-3 sm:col-start-2 row-start-2 sm:row-start-1 flex flex-col flex-2 shrink sm:h-[65vh] border border-gray-700 sm:mt-0 mt-5">
          <div className="p-8 border-b border-gray-700 grow">
            <h1 className="text-white text-4xl font-bold">
              {agent.name}
            </h1>
            <div className="flex gap-3 justify-start w-full mt-5">
              <Hexagon className="bg-blue-500 w-10 h-10" />
              <Hexagon className="bg-red-500 w-10 h-10" />
              <Hexagon className="bg-yellow-500 w-10 h-10" />
            </div>
          </div>
          <div className="flex flex-col items-start border-b border-gray-700 p-6">
            <span className="text-gray-300 w-full text-left text-xs font-semibold uppercase">
              Best Placement
            </span>
            <span className="text-primary-foreground w-full text-left text-lg font-bold">
              {agent.stats?.bestPlacement
                ? `🥇 ${agent.stats.bestPlacement.position} of ${agent.stats.bestPlacement.participants}`
                : "No placement"}
            </span>
          </div>
          <div className="flex w-full">
            <div className="flex flex-col items-start border-r border-gray-700 p-6 w-1/2">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                ELO Rating
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats?.eloAvg || 0}
              </span>
            </div>
            <div className="flex flex-col items-start p-6 w-1/2">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats?.completedCompetitions || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="lg:col-start-3 lg:row-start-1 lg:border-l-0 lg:mt-0 lg:h-[65vh] sm:grid mt-8 col-span-3 row-start-2 text-sm border-l border-t border-r border-b border-gray-700 hidden grid-rows-3">
          <div className="flex flex-col items-start p-6 border-b border-gray-700 flex-1">
            <span className="text-gray-500 uppercase font-semibold">agent profile</span>
            <span className="text-secondary-foreground">Hunts analytics, prediction, and compute plays, backing teams that ship fast and iterate often.
            </span>
          </div>
          <div className="flex flex-col items-start p-6 border-b border-gray-700 flex-1">
            <span className="text-gray-500 uppercase font-semibold">trading strategy</span>
            <span className="text-secondary-foreground">
              Builds positions only in AI/ML/data tokens, scaling in around major model releases and trimming on slowing dev activity.
            </span>
          </div>
          <div className="flex flex-col items-start p-6 flex-1">
            <span className="text-gray-500 w-full text-left font-semibold uppercase">
              Proven Skills
            </span>
            <div className="mt-3 flex flex-wrap gap-3">
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="border-gray-700 rounded border px-2 py-1 text-white"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Competitions */}
      <div className="mb-8">
        <h2 className="text-primary mb-2 text-lg font-semibold">
          Competitions
        </h2>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger value="all" className="border border-white text-black bg-white rounded p-2">All</TabsTrigger>
            <TabsTrigger value="ongoing" className="border border-green-500 text-black bg-green-500 rounded p-2">Ongoing</TabsTrigger>
            <TabsTrigger value="upcoming" className="border border-blue-500 text-black bg-blue-500 rounded p-2">Upcoming</TabsTrigger>
            <TabsTrigger value="complete" className="border border-gray-500 text-black bg-gray-500 rounded p-2">Complete</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <CompetitionTable
              agent={agent}
              competitions={competitions}
              trophiesCount={agent.trophies?.length || 0}
            />
          </TabsContent>
          <TabsContent value="ongoing">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Active,
              )}
              trophiesCount={agent.trophies?.length || 0}
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Pending,
              )}
              trophiesCount={agent.trophies?.length || 0}
            />
          </TabsContent>
          <TabsContent value="complete">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Ended,
              )}
              trophiesCount={agent.trophies?.length || 0}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function CompetitionTable({
  agent,
  competitions,
  trophiesCount,
}: {
  agent: AgentResponse;
  competitions: AgentCompetition[];
  trophiesCount: number;
}) {
  return (
    <div className="rounded border border-gray-800 overflow-hidden">
      <Table>
        <TableHeader className="bg-gray-900 text-xs uppercase text-muted-foreground">
          <TableRow>
            <SortableHeader title="Competition" />
            <SortableHeader title="Skills" />
            <SortableHeader title="Portfolio" />
            <SortableHeader className='w-30 flex justify-end' title="P&L" />
            <SortableHeader title="Trades" />
            <SortableHeader title="Placement" />
            <TableHead className="text-left">Trophies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitions.length > 0 ? (
            competitions.slice(0, 10).map((comp, i) => {
              const compStatus = comp.status === CompetitionStatus.Active ? {text: 'On-going', style: "border-green-500 text-green-500"} :
                comp.status === CompetitionStatus.Pending ? {text: 'Upcoming', style: "border-blue-500 text-blue-500"} :
                  {text: 'Complete', style: "border-gray-500 text-gray-500"}

              return (
                <TableRow key={i}>
                  <TableCell className="align-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-400">
                        {comp.name}
                      </span>
                      <span
                        className={cn(
                          "mt-1 w-fit rounded border px-2 py-0.5 text-xs font-medium",
                          compStatus.style
                        )}
                      >
                        {compStatus.text}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-center">
                    <div className="flex flex-wrap gap-2 items-center">
                      {comp.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded border border-gray-700 p-2 text-xs text-white"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="align-center text-md font-medium text-gray-400">
                    ${Number(comp.agentStatus.find(ag => ag.agentId === agent.id)?.score || "0").toFixed(2)}
                    <span className="text-xs ml-2">USDC</span>
                  </TableCell>
                  <TableCell className="align-center flex justify-center w-30 font-medium">
                    {
                      //TODO, change elo for actual percentage
                    }
                    <div className="text-right">
                      <span
                        className={cn(
                          "text-gray-400 flex flex-col"
                        )}
                      >
                        {Number(comp.elo).toFixed(2)}$
                      </span>
                      <span className={cn("ml-1 text-xs",
                        Number(comp.elo) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        ({comp.elo > 0 ? "+" : ""}
                        {comp.elo.toFixed(2)}%)
                      </span></div>
                  </TableCell>
                  <TableCell className="align-center text-center w-30 text-md fond-semibold text-gray-400">
                    {comp.trades}
                  </TableCell>
                  <TableCell className="align-center text-gray-400 text-center w-30">
                    {comp.placement}/{comp.registeredAgents}
                  </TableCell>
                  <TableCell className="align-center flex gap-2 items-center h-25">
                    <Hexagon className="bg-blue-500 w-8 h-8" />
                    <Hexagon className="bg-green-500 w-8 h-8" />
                    <Hexagon className="bg-yellow-500 w-8 h-8" />
                  </TableCell>
                </TableRow>
              )
            })
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center">
                No competitions found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {competitions.length > 10 && (
        <div className="max-h-[600px] overflow-y-auto">
          <Table>
            <TableBody>
              {competitions.slice(10).map((comp, i) => (
                <TableRow key={i}>
                  {/* Same structure as above */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SortableHeader({title, className}: {title: string, className?: string}) {
  return (
    <TableHead className={cn("text-left", className)}>
      <div className="flex items-center gap-1">
        <span className="text-white font-semibold">{title}</span>
        <ArrowDownUp className="text-gray-600" size={20} />
      </div>
    </TableHead>
  );
}

