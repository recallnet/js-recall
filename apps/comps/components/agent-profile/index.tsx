"use client";

import {Share2Icon} from "lucide-react";
import React from "react";

import Card from "@recallnet/ui2/components/card";
import {
  SortState,
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

import {Hexagon} from "@/components/hexagon";
import MirrorImage from "@/components/mirror-image";
import {Agent, AgentWithOwnerResponse, Competition, CompetitionStatus, CrossChainTradingType} from "@/types";
import {BreadcrumbNav} from "../breadcrumb-nav";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";

export default function AgentProfile({
  id,
  agent,
  owner,
  handleSortChange,
  sortState,
  setStatus
}: {
  id: string;
  agent: Agent;
  owner: AgentWithOwnerResponse['owner'];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  setStatus: (status: string) => void;
  status: string;
}) {
  const skills = agent?.skills || [];
  const trophies = (agent?.trophies || []) as string[];

  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `,${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const comp = {
    id: 'id',
    name: "name",
    description: "description",
    externalUrl: "externalUrl",
    imageUrl: "imageUrl",
    type: "type",
    status: CompetitionStatus.Active,
    crossChainTradingType: CrossChainTradingType.Allow,
    startDate: null,
    endDate: null,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    stats: {
      totalTrades: 0,
      totalAgents: 0,
      totalVolume: 0,
      uniqueTokens: 0,
    },
    votingEnabled: true,
    userVotingInfo: {
      canVote: true,
      info: {
        hasVoted: true,
      }
    }
  }

  const {data: compsData} =
    useAgentCompetitions(id, {sort: sortString, status});
  const competitions = compsData?.competitions || []

  return (
    <>
      <BreadcrumbNav
        items={[
          {label: "RECALL"},
          {label: "AGENTS", href: "/competitions"},
          {label: agent.name},
        ]}
        className="mb-10"
      />

      <div className="xs:grid-rows-[65vh_1fr] my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl md:grid-cols-[400px_1fr_1fr]">
        <Card
          className="xs:col-span-1 xs:mr-8 col-span-3 flex h-[65vh] flex-col items-center justify-between bg-gray-900 p-8"
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
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 xs:h-[65vh] col-span-3 row-start-2 mt-5 flex shrink flex-col border lg:col-span-1 lg:col-start-2">
          <div className="grow border-b p-8">
            <h1 className="truncate text-4xl font-bold text-white">
              {agent.name}
            </h1>
            <div className="mt-5 flex w-full gap-3">
              <span className="text-xl font-semibold text-gray-400">
                Developed by
              </span>
              <span className="truncate text-xl font-semibold text-gray-400 text-white">
                {owner?.name}
              </span>
            </div>
            <div className="mt-8 flex w-full justify-start gap-3">
              {trophies.length > 0 ? (
                trophies.map((_: unknown, i: number) => (
                  <Hexagon
                    key={i}
                    className={`h-10 w-10 bg-${["blue-500", "red-500", "yellow-500"][i % 3]}`}
                  />
                ))
              ) : (
                <span className="text-gray-200">
                  This agent hasn’t earned trophies yet.
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 border-b px-6 py-12 text-sm">
            <span className="w-full text-left font-semibold uppercase text-gray-400">
              Best Placement
            </span>
            <span className="w-full text-left text-gray-300">
              {agent.stats?.bestPlacement
                ? `🥇 ${agent.stats.bestPlacement.position} of ${agent.stats.bestPlacement.participants}`
                : "No completed yet"}
            </span>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/2 flex-col items-start p-6">
              <span className="w-full text-left text-xs font-semibold uppercase text-gray-400">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats.completedCompetitions}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start border-l p-6">
              <span className="w-full text-left text-xs font-semibold uppercase text-gray-400">
                ELO
              </span>
              <span className="w-full text-left text-gray-300">
                Not rated yet
              </span>
            </div>
          </div>
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 border-b border-l border-r border-t text-sm lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:grid-rows-3 lg:border-l-0">
          <div className="flex flex-col items-start gap-2 border-b p-6 lg:row-span-2">
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
              {skills.length > 0
                ? skills.map((skill, index) => (
                  <span
                    key={index}
                    className="rounded border px-2 py-1 text-white"
                  >
                    {skill}
                  </span>
                ))
                : "This agent hasnt showcased skills yet."}
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
          onValueChange={setStatus}
        >
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger
              value="all"
              className={cn(
                "rounded border border-white p-2 text-black",
                status === "all" ? "bg-white" : "text-white",
              )}
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="ongoing"
              className={cn(
                "rounded border border-green-500 p-2",
                status === "ongoing"
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
                status === "upcoming"
                  ? "bg-blue-500 text-white"
                  : "text-blue-500",
              )}
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger
              value="ended"
              className={cn(
                "rounded border p-2 text-black",
                status === "ended"
                  ? "bg-gray-500 text-white"
                  : "text-gray-500",
              )}
            >
              Complete
            </TabsTrigger>
          </TabsList>
          <CompetitionTable
            handleSortChange={handleSortChange}
            sortState={sortState}
            isLoading={false}
            competitions={competitions || []}
          />
        </Tabs>
      </div>
    </>
  );
}

function CompetitionTable({
  competitions,
  handleSortChange,
  sortState,
  isLoading,
}: {
  competitions: Competition[] | undefined;
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  isLoading: boolean;
}) {
  console.log({isLoading})
  return (
    <div className="overflow-hidden rounded border">
      <Table>
        <TableHeader className="text-muted-foreground bg-gray-900 text-xs uppercase">
          <TableRow className="grid w-full grid-cols-7">
            <SortableTableHeader
              onToggleSort={() => handleSortChange("name")}
              sortState={sortState["name"]}
            >
              Competition
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("skills")}
              sortState={sortState["skills"]}
            >
              Skills
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("portfolio")}
              sortState={sortState["portfolio"]}
            >
              Portfolio
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("pnl")}
              sortState={sortState["pnl"]}
              className="w-30 flex justify-end"
            >
              P&L
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("trades")}
              sortState={sortState["trades"]}
            >
              Trades
            </SortableTableHeader>
            <SortableTableHeader
              onToggleSort={() => handleSortChange("placement")}
              sortState={sortState["placement"]}
            >
              Placement
            </SortableTableHeader>
            <TableHead className="text-left">Trophies</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {!isLoading && competitions && competitions.length > 0 ? (
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
                <TableRow key={i} className="grid grid-cols-7">
                  <TableCell className="flex flex-col justify-center">
                    <span className="truncate text-sm font-semibold text-gray-400">
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
                  </TableCell>
                  <TableCell className="flex flex-wrap items-center gap-2">
                    {/* Future skills mapping */}
                  </TableCell>
                  <TableCell className="text-md flex items-center font-medium text-gray-400">
                    $0<span className="ml-2 text-xs">USDC</span>
                  </TableCell>
                  <TableCell className="w-30 flex items-center justify-center font-medium">
                    <span className="flex flex-col text-gray-400">0$</span>
                  </TableCell>
                  <TableCell className="w-30 text-md fond-semibold flex items-center text-center text-gray-400">
                    0
                  </TableCell>
                  <TableCell className="w-30 flex items-center text-center text-gray-400">
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
                {
                  isLoading ?
                    <div>LOADING</div>
                    :
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-400">
                        This agent hasn’t joined any competitions yet
                      </span>
                      <span className="text-gray-600">
                        Participated competitions will appear here once the agent
                        enters one.
                      </span>
                    </div>
                }
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
                <TableRow key={i}>{/* Same structure */}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
