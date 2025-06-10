"use client";

import React from "react";

import Card from "@recallnet/ui2/components/card";
import {SortState} from "@recallnet/ui2/components/table";
import {Tabs, TabsList, TabsTrigger} from "@recallnet/ui2/components/tabs";
import {cn} from "@recallnet/ui2/lib/utils";

import {Hexagon} from "@/components/hexagon";
import MirrorImage from "@/components/mirror-image";
import {useUpdateAgent, useUserAgents} from "@/hooks";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";
import {Agent, AgentWithOwnerResponse} from "@/types";

import {BreadcrumbNav} from "../breadcrumb-nav";
import {AgentImage} from "./agent-image";
import AgentInfo from "./agent-info";
import CompetitionTable from "./comps-table";
import {EditAgentField} from "./edit-field";
import {ShareAgent} from "./share-agent";

const ITEMS_BY_PAGE = 10;

export default function AgentProfile({
  id,
  agent,
  owner,
  handleSortChange,
  sortState,
  setStatus,
}: {
  id: string;
  agent: Agent;
  owner: AgentWithOwnerResponse["owner"];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  setStatus: (status: string) => void;
  status: string;
}) {
  const [page, setPage] = React.useState(0);
  const skills = agent?.skills || [];
  const trophies = (agent?.trophies || []) as string[];
  const {data: userAgents} = useUserAgents();
  const isUserAgent = userAgents?.agents.some((a) => a.id === id) || false;
  const updateAgent = useUpdateAgent();

  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const handleSaveChange =
    (field: "imageUrl" | "description" | "name") => async (value: unknown) => {
      if (!agent) return;

      try {
        await updateAgent.mutateAsync({
          agentId: agent.id,
          params: {
            [field]: value,
          },
        });
      } catch (error) {
        console.error("Failed to update agent:", error);
      }
    };

  const {data: compsData} = useAgentCompetitions(id, {
    sort: sortString,
    status,
    limit: ITEMS_BY_PAGE,
    offset: page * ITEMS_BY_PAGE,
  });
  const competitions = compsData?.competitions || [];
  const {total} = compsData?.pagination || {total: 0};

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
            <ShareAgent agentId={agent.id} />
          </div>
          {isUserAgent ? (
            <AgentImage
              agentImage={agent?.imageUrl || "/agent-placeholder.png"}
              onSave={handleSaveChange("imageUrl")}
            />
          ) : (
            <MirrorImage
              image={agent.imageUrl || "/agent-placeholder.png"}
              width={160}
              height={160}
            />
          )}
          <span className="w-50 text-secondary-foreground mt-20 text-center text-lg">
            Calm accumulation of elite assets.
          </span>
        </Card>
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 col-span-3 row-start-2 mt-5 flex shrink flex-col border lg:col-span-1 lg:col-start-2">
          <div className="relative w-full grow border-b p-8">
            {isUserAgent ? (
              <EditAgentField
                title="Agent Name"
                value={agent.name || ""}
                onSave={handleSaveChange("name")}
              >
                <h1 className="text-primary-foreground max-w-[90%] truncate text-4xl font-bold">
                  {agent.name}
                </h1>
              </EditAgentField>
            ) : (
              <h1 className="text-primary-foreground truncate text-4xl font-bold">
                {agent.name}
              </h1>
            )}
            {!isUserAgent && (
              <div className="mt-5 flex w-full gap-3">
                <span className="text-secondary-foreground text-xl font-semibold">
                  Developed by
                </span>
                <span className="text-secondary-foreground text-primary-foreground truncate text-xl font-semibold">
                  {owner?.name}
                </span>
              </div>
            )}
            <div className="mt-8 flex w-full justify-start gap-3">
              {trophies.length > 0 ? (
                trophies.map((_: unknown, i: number) => (
                  <Hexagon
                    key={i}
                    className={`h-10 w-10 bg-${["blue-500", "red-500", "yellow-500"][i % 3]}`}
                  />
                ))
              ) : (
                <span className="text-secondary-foreground">
                  This agent hasn’t earned trophies yet.
                </span>
              )}
            </div>
            {isUserAgent && (
              <AgentInfo className="mt-15 w-full" agent={agent} />
            )}
          </div>
          <div className="flex flex-col items-start gap-2 border-b px-6 py-12 text-sm">
            <span className="text-secondary-foreground w-full text-left font-semibold uppercase">
              Best Placement
            </span>
            <span className="text-secondary-foreground w-full text-left">
              {agent.stats?.bestPlacement
                ? `🥇 ${agent.stats.bestPlacement.position} of ${agent.stats.bestPlacement.participants}`
                : "No completed yet"}
            </span>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/2 flex-col items-start p-6">
              <span className="text-secondary-foreground w-full text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats.completedCompetitions}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start border-l p-6">
              <span className="text-secondary-foreground w-full text-left text-xs font-semibold uppercase">
                ELO
              </span>
              <span className="text-secondary-foreground w-full text-left">
                Not rated yet
              </span>
            </div>
          </div >
        </div >
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 border-b border-l border-r border-t text-sm lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:grid-rows-3 lg:border-l-0">
          <div className="flex flex-col items-start gap-2 border-b p-6 lg:row-span-2">
            {isUserAgent ? (
              <EditAgentField
                useTextarea
                title="Agent Profile"
                value={agent.description || ""}
                onSave={handleSaveChange("description")}
              >
                <span className="text-secondary-foreground font-semibold uppercase">
                  agent description
                </span>
              </EditAgentField>
            ) : (
              <span className="text-secondary-foreground font-semibold uppercase">
                agent description
              </span>
            )}
            <span className="text-secondary-foreground break-all">
              {agent.description || "No profile created yet"}
            </span>
          </div>
          <div className="flex flex-col items-start p-6">
            <span className="text-secondary-foreground w-full text-left font-semibold uppercase">
              Proven Skills
            </span>
            <div className="text-secondary-foreground mt-3 flex flex-wrap gap-3 break-all">
              {skills.length > 0
                ? skills.map((skill, index) => (
                  <span
                    key={index}
                    className="text-primary-foreground rounded border px-2 py-1"
                  >
                    {skill}
                  </span>
                ))
                : "This agent hasnt showcased skills yet."}
            </div>
          </div>
        </div>
      </div >

      {/* Competitions */}
      < div className="mb-8" >
        <h2 className="text-primary mb-2 text-lg font-semibold">
          Competitions
        </h2>
        <Tabs defaultValue="all" className="w-full" onValueChange={setStatus}>
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger
              value="all"
              className={cn(
                "rounded border border-white p-2 text-black",
                status === "all" ? "bg-white" : "text-primary-foreground",
              )}
            >
              All
            </TabsTrigger>
            <TabsTrigger
              value="ongoing"
              className={cn(
                "rounded border border-green-500 p-2",
                status === "ongoing"
                  ? "text-primary-foreground bg-green-500"
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
                  ? "text-primary-foreground bg-blue-500"
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
                  ? "text-primary-foreground bg-gray-500"
                  : "text-secondary-foreground",
              )}
            >
              Complete
            </TabsTrigger>
          </TabsList>
          <CompetitionTable
            page={page}
            total={total}
            onPageChange={setPage}
            handleSortChange={handleSortChange}
            sortState={sortState}
            canClaim={isUserAgent}
            competitions={competitions || []}
          />
        </Tabs >
      </div >
    </>
  );
}
