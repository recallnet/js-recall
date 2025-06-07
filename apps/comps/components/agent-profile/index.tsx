"use client";

import {Share2Icon} from "lucide-react";
import React from "react";

import Card from "@recallnet/ui2/components/card";
import {
  SortableTableHeader,
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
import {Competition, CompetitionStatus} from "@/types";

export default function AgentProfile({id}: {id: string}) {
  const {
    data: agent,
    isLoading: isLoadingAgent,
    error: agentError,
  } = useAgent(id);
  const [selected, setSelected] = React.useState("all");
  const {data: agentCompetitionsData, isLoading: isLoadingCompetitions} =
    useAgentCompetitions(id);

  if (isLoadingAgent || isLoadingCompetitions)
    return <div className="py-20 text-center">Loading agent data...</div>;
  if (agentError || !agent)
    return <div className="py-20 text-center">Agent not found</div>;

  const skills = agent.stats?.skills || [];

  return (
    <>
      <Breadcrumbs
        items={[
          {title: "RECALL", href: "/"},
          {title: "AGENTS", href: "/"},
          {title: agent.name, href: "/"},
        ]}
      />

      <div className="my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl border-t border-gray-700 pt-5 xs:grid-rows-[65vh_1fr] md:grid-cols-[400px_1fr_1fr]">
        <Card
          className="col-span-3 flex h-[65vh] flex-col items-center justify-between bg-gray-900 p-8 xs:col-span-1 xs:mr-8"
          corner="top-left"
          cropSize={45}
        >
          <div className="flex w-full justify-end">
            <Share2Icon className="text-gray-600" size={30} />
          </div>
          <MirrorImage
            image={agent.imageUrl || "/agent-placeholder.png"}
            width={160}
            height={160}
          />
          <span className="w-50 mt-20 text-center text-lg text-gray-400">
            Calm accumulation of elite assets.
          </span>
        </Card>
        <div className="flex-2 col-span-3 row-start-2 mt-5 flex shrink flex-col border border-gray-700 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 xs:h-[65vh] lg:col-span-1 lg:col-start-2">
          <div className="grow border-b border-gray-700 p-8">
            <h1 className="text-4xl font-bold text-white truncate">{agent.name}</h1>
            <div className="w-full mt-5 flex gap-3">
              <span className="text-xl text-gray-400 font-semibold">Developed by</span>
              <span className="text-xl text-gray-400 font-semibold text-white truncate">{agent.name}</span>
            </div>
            <div className="mt-8 flex w-full justify-start gap-3">
              {
                agent.metadata?.trophies.length > 0 ?
                  agent.metadata?.trophies.map((_: unknown, i: number) => (
                    <Hexagon className={`h-10 w-10 bg-${['blue-500', 'red-500', 'yellow-500'][i % 3]}`} />
                  ))
                  :
                  <span className="text-gray-200">This agent hasn’t earned trophies yet.</span>
              }
            </div>
          </div>
          <div className="flex flex-col items-start border-b border-gray-700 px-6 py-12 text-sm gap-2">
            <span className="w-full text-left font-semibold uppercase text-gray-400">
              Best Placement
            </span>
            <span className="text-gray-300 w-full text-left">
              {agent.stats?.bestPlacement
                ? `🥇 ${agent.stats.bestPlacement.position} of ${agent.stats.bestPlacement.participants}`
                : "No completed yet"}
            </span>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/2 flex-col items-start p-6">
              <span className="text-gray-400 w-full text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {0}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start border-l border-gray-700 p-6">
              <span className="text-gray-400 w-full text-left text-xs font-semibold uppercase">
                ELO Rating
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {0}
              </span>
            </div>
          </div>
        </div>
        <div className="col-span-3 row-start-2 mt-8 hidden lg:grid-rows-3 grid-rows-2 border-b border-l border-r border-t border-gray-700 text-sm xs:grid lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:border-l-0">
          <div className="flex flex-col items-start border-b border-gray-700 p-6 gap-2 lg:row-span-2">
            <span className="font-semibold uppercase text-gray-400">
              agent description
            </span>
            <span className="text-gray-400">
              {agent.description || "No profile created yet"}
            </span>
          </div>
          <div className="flex flex-col items-start p-6">
            <span className="w-full text-left font-semibold uppercase text-gray-500">
              Proven Skills
            </span>
            <div className="mt-3 flex flex-wrap gap-3 text-gray-400">
              {skills.length > 0 ? skills.map((skill, index) => (
                <span
                  key={index}
                  className="rounded border border-gray-700 px-2 py-1 text-white"
                >
                  {skill}
                </span>
              )) : "This agent hasnt showcased skills yet."}
            </div>
          </div>
        </div>
      </div>

      {/* Competitions */}
      <div className="mb-8">
        <h2 className="text-primary mb-2 text-lg font-semibold">
          Competitions
        </h2>
        <Tabs
          defaultValue="all"
          className="w-full"
          onValueChange={(value: string) => setSelected(value)}
        >
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger
              value="all"
              className={cn(
                "rounded border border-white p-2 text-black",
                selected === "all" ? "bg-white" : "text-white",
              )}
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="ongoing"
              className={cn(
                "rounded border border-green-500 p-2",
                selected === "ongoing"
                  ? "bg-green-500 text-white"
                  : "text-green-500",
              )}
            >
              Ongoing
            </TabsTrigger>
            <TabsTrigger
              value="upcoming"
              className={cn(
                "rounded border border-blue-500 p-2 text-black",
                selected === "upcoming"
                  ? "bg-blue-500 text-white"
                  : "text-blue-500",
              )}
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger
              value="ended"
              className={cn(
                "rounded border border-gray-500 p-2 text-black",
                selected === "ended"
                  ? "bg-gray-500 text-white"
                  : "text-gray-500",
              )}
            >
              Complete
            </TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <CompetitionTable
              competitions={agentCompetitionsData?.competitions || []}
            />
          </TabsContent>
          <TabsContent value="ongoing">
            <CompetitionTable
              competitions={agentCompetitionsData?.competitions.filter(
                (c) => c.status === CompetitionStatus.Active,
              )}
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <CompetitionTable
              competitions={agentCompetitionsData?.competitions.filter(
                (c) => c.status === CompetitionStatus.Pending,
              )}
            />
          </TabsContent>
          <TabsContent value="complete">
            <CompetitionTable
              competitions={agentCompetitionsData?.competitions.filter(
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
  competitions,
}: {
  competitions: Competition[] | undefined;
}) {
  return (
    <div className="overflow-hidden rounded border border-gray-800">
      <Table>
        <TableHeader className="text-muted-foreground bg-gray-900 text-xs uppercase">
          <TableRow className='grid grid-cols-7 w-full'>
            <SortableTableHeader>Competition</SortableTableHeader>
            <SortableTableHeader>Skills</SortableTableHeader>
            <SortableTableHeader>Portfolio</SortableTableHeader>
            <SortableTableHeader className="w-30 flex justify-end">
              P&L
            </SortableTableHeader>
            <SortableTableHeader>Trades</SortableTableHeader>
            <SortableTableHeader>Placement</SortableTableHeader>
            <TableHead className="text-left">Trophies</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {competitions && competitions.length > 0 ? (
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
                <TableRow key={i} className='grid grid-cols-7'>
                  <TableCell className="align-center">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-gray-400 truncate">
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
                      {/*  {comp.skills.map((skill, idx) => (
                        <span
                          key={idx}
                          className="rounded border border-gray-700 p-2 text-xs text-white"
                        >
                          {skill}
                        </span>
                      ))} */}
                    </div>
                  </TableCell>
                  <TableCell className="align-center text-md font-medium text-gray-400">
                    $0
                    <span className="ml-2 text-xs">USDC</span>
                  </TableCell>
                  <TableCell className="align-center w-30 flex justify-center font-medium">
                    {
                      //TODO, change elo for actual percentage
                    }
                    <div className="text-right">
                      <span className={cn("flex flex-col text-gray-400")}>
                        0$
                      </span>
                      <span>0</span>
                    </div>
                  </TableCell>
                  <TableCell className="align-center w-30 text-md fond-semibold text-center text-gray-400">
                    0
                  </TableCell>
                  <TableCell className="align-center w-30 text-center text-gray-400">
                    0/0
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
              <TableCell colSpan={7} className="p-5 text-center">
                <div className="flex flex-col">
                  <span className="font-bold text-gray-400">
                    This agent hasn’t joined any competitions yet
                  </span>
                  <span className="text-gray-600">
                    Participated competitions will appear here once the agent
                    enters one.
                  </span>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {competitions && competitions.length > 10 && (
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
