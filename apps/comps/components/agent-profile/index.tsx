"use client";

import {ArrowDownUp, Share2Icon} from "lucide-react";
import React from "react";

import Card from "@recallnet/ui2/components/shadcn/card";
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

import {Breadcrumbs} from "@/components/breadcrumb";
import {Hexagon} from "@/components/hexagon";
import MirrorImage from "@/components/mirror-image";
import {useAgent} from "@/hooks/useAgent";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";
import {AgentResponse, CompetitionResponse, CompetitionStatus} from "@/types";

type AgentCompetition = CompetitionResponse & {
  placement: string;
  roi: string;
  trades: number;
  elo: number;
};

export default function AgentProfile({id}: {id: string}) {
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

  return (
    <>
      <Breadcrumbs
        items={[
          {title: "RECALL", href: "/"},
          {title: "AGENTS", href: "/"},
          {title: agent.name, href: "/"},
        ]}
      />

      <div className="my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl border-t border-gray-700 pt-5 sm:grid-rows-[65vh_1fr] md:grid-cols-[400px_1fr_1fr]">
        <Card
          className="col-span-3 flex h-[65vh] flex-col items-center justify-between bg-gray-900 p-8 sm:col-span-1 sm:mr-8"
          corner="top-left"
          cropSize={45}
        >
          <div className="flex w-full justify-end">
            <Share2Icon className="text-gray-600" size={30} />
          </div>
          <MirrorImage
            image={agent.imageUrl || "/agent-image.png"}
            width={160}
            height={160}
          />
          <span className="w-50 mt-20 text-center text-lg text-gray-400">
            Calm accumulation of elite assets.
          </span>
        </Card>
        <div className="flex-2 col-span-3 row-start-2 mt-5 flex shrink flex-col border border-gray-700 sm:col-span-2 sm:col-start-2 sm:row-start-1 sm:mt-0 sm:h-[65vh] lg:col-span-1 lg:col-start-2">
          <div className="grow border-b border-gray-700 p-8">
            <h1 className="text-4xl font-bold text-white">{agent.name}</h1>
            <div className="mt-5 flex w-full justify-start gap-3">
              <Hexagon className="h-10 w-10 bg-blue-500" />
              <Hexagon className="h-10 w-10 bg-red-500" />
              <Hexagon className="h-10 w-10 bg-yellow-500" />
            </div>
          </div>
          <div className="flex flex-col items-start border-b border-gray-700 p-6">
            <span className="w-full text-left text-xs font-semibold uppercase text-gray-300">
              Best Placement
            </span>
            <span className="text-primary-foreground w-full text-left text-lg font-bold">
              {agent.stats?.bestPlacement
                ? `🥇 ${agent.stats.bestPlacement.position} of ${agent.stats.bestPlacement.participants}`
                : "No placement"}
            </span>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/2 flex-col items-start border-r border-gray-700 p-6">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                ELO Rating
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats?.eloAvg || 0}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start p-6">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats?.completedCompetitions || 0}
              </span>
            </div>
          </div>
        </div>
        <div className="col-span-3 row-start-2 mt-8 hidden grid-rows-3 border-b border-l border-r border-t border-gray-700 text-sm sm:grid lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:border-l-0">
          <div className="flex flex-1 flex-col items-start border-b border-gray-700 p-6">
            <span className="font-semibold uppercase text-gray-500">
              agent profile
            </span>
            <span className="text-secondary-foreground">
              Hunts analytics, prediction, and compute plays, backing teams that
              ship fast and iterate often.
            </span>
          </div>
          <div className="flex flex-1 flex-col items-start border-b border-gray-700 p-6">
            <span className="font-semibold uppercase text-gray-500">
              trading strategy
            </span>
            <span className="text-secondary-foreground">
              Builds positions only in AI/ML/data tokens, scaling in around
              major model releases and trimming on slowing dev activity.
            </span>
          </div>
          <div className="flex flex-1 flex-col items-start p-6">
            <span className="w-full text-left font-semibold uppercase text-gray-500">
              Proven Skills
            </span>
            <div className="mt-3 flex flex-wrap gap-3">
              {skills.map((skill, index) => (
                <span
                  key={index}
                  className="rounded border border-gray-700 px-2 py-1 text-white"
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
            <TabsTrigger
              value="all"
              className="rounded border border-white bg-white p-2 text-black"
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="ongoing"
              className="rounded border border-green-500 bg-green-500 p-2 text-black"
            >
              Ongoing
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className="rounded border border-blue-500 bg-blue-500 p-2 text-black"
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger
              value="complete"
              className="rounded border border-gray-500 bg-gray-500 p-2 text-black"
            >
              Complete
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <CompetitionTable
              agent={agent}
              competitions={competitions}
            />
          </TabsContent>
          <TabsContent value="ongoing">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Active,
              )}
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Pending,
              )}
            />
          </TabsContent>
          <TabsContent value="complete">
            <CompetitionTable
              agent={agent}
              competitions={competitions.filter(
                (c) => c.status === CompetitionStatus.Ended,
              )}
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
}: {
  agent: AgentResponse;
  competitions: AgentCompetition[];
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-800">
      <Table>
        <TableHeader className="text-muted-foreground bg-gray-900 text-xs uppercase">
          <TableRow>
            <SortableHeader title="Competition" />
            <SortableHeader title="Skills" />
            <SortableHeader title="Portfolio" />
            <SortableHeader className="w-30 flex justify-end" title="P&L" />
            <SortableHeader title="Trades" />
            <SortableHeader title="Placement" />
            <TableHead className="text-left">Trophies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitions.length > 0 ? (
            competitions.slice(0, 10).map((comp, i) => {
              const compStatus =
                comp.status === CompetitionStatus.Active
                  ? {
                    text: "On-going",
                    style: "border-green-500 text-green-500",
                  }
                  : comp.status === CompetitionStatus.Pending
                    ? {
                      text: "Upcoming",
                      style: "border-blue-500 text-blue-500",
                    }
                    : {
                      text: "Complete",
                      style: "border-gray-500 text-gray-500",
                    };

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
                          compStatus.style,
                        )}
                      >
                        {compStatus.text}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-center">
                    <div className="flex flex-wrap items-center gap-2">
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
                    $
                    {Number(
                      comp.agentStatus.find((ag) => ag.agentId === agent.id)
                        ?.score || "0",
                    ).toFixed(2)}
                    <span className="ml-2 text-xs">USDC</span>
                  </TableCell>
                  <TableCell className="align-center w-30 flex justify-center font-medium">
                    {
                      //TODO, change elo for actual percentage
                    }
                    <div className="text-right">
                      <span className={cn("flex flex-col text-gray-400")}>
                        {Number(comp.elo).toFixed(2)}$
                      </span>
                      <span
                        className={cn(
                          "ml-1 text-xs",
                          Number(comp.elo) >= 0
                            ? "text-green-600"
                            : "text-red-600",
                        )}
                      >
                        ({comp.elo > 0 ? "+" : ""}
                        {comp.elo.toFixed(2)}%)
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="align-center w-30 text-md fond-semibold text-center text-gray-400">
                    {comp.trades}
                  </TableCell>
                  <TableCell className="align-center w-30 text-center text-gray-400">
                    {comp.placement}/{comp.registeredAgents}
                  </TableCell>
                  <TableCell className="align-center h-25 flex items-center gap-2">
                    <Hexagon className="h-8 w-8 bg-blue-500" />
                    <Hexagon className="h-8 w-8 bg-green-500" />
                    <Hexagon className="h-8 w-8 bg-yellow-500" />
                  </TableCell>
                </TableRow>
              );
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
                <TableRow key={i}>{/* Same structure as above */}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function SortableHeader({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <TableHead className={cn("text-left", className)}>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-white">{title}</span>
        <ArrowDownUp className="text-gray-600" size={20} />
      </div>
    </TableHead>
  );
}
