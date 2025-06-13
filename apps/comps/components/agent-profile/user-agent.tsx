"use client";

import React from "react";

import Card from "@recallnet/ui2/components/card";
import { SortState } from "@recallnet/ui2/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Hexagon } from "@/components/hexagon";
import { useUpdateAgent } from "@/hooks";
import { useAgent } from "@/hooks/useAgent";
import { useAgentCompetitions } from "@/hooks/useAgentCompetitions";
import { CompetitionStatus } from "@/types";

import { AgentImage } from "./agent-image";
import { AgentInfo } from "./agent-info";
import { CompetitionTable } from "./comps-table";
import { EditAgentField } from "./edit-field";
import { ShareAgent } from "./share-agent";

export default function UserAgent({ id }: { id: string }) {
  const { data, isLoading: isLoadingAgent, error: agentError } = useAgent(id);
  const { agent } = data || {};

  const updateAgent = useUpdateAgent();

  const [selected, setSelected] = React.useState("all");
  const [sortState, setSorted] = React.useState(
    {} as Record<string, SortState>,
  );
  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none")
        return (
          acc + `${acc.length > 0 ? "," : ""}${sort == "asc" ? "" : "-"}${key}`
        );
      return acc;
    }, "");
  }, [sortState]);

  const skills = agent?.skills || [];
  const trophies = (agent?.trophies || []) as string[];

  const { data: agentCompetitionsData, isLoading: isLoadingCompetitions } =
    useAgentCompetitions(id, { sort: sortString });

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return { ...sort, [field]: nxt };
    });
  }, []);

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

  if (isLoadingAgent || isLoadingCompetitions)
    return <div className="py-20 text-center">Loading agent data...</div>;
  if (agentError || !agent)
    return <div className="py-20 text-center">Agent not found</div>;

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: "RECALL", href: "/" },
          { label: "AGENTS", href: "/competitions" },
          { label: agent.name, href: "/" },
        ]}
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
          <AgentImage
            agentImage={agent?.imageUrl || "/agent-placeholder.png"}
            onSave={handleSaveChange("imageUrl")}
          />
          <span className="w-50 mt-20 text-center text-lg text-gray-400">
            Calm accumulation of elite assets.
          </span>
        </Card>
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 xs:h-[65vh] col-span-3 row-start-2 mt-5 flex shrink flex-col border border-gray-700 lg:col-span-1 lg:col-start-2">
          <div className="flex grow flex-col justify-between border-b border-gray-700 p-8">
            <div className="flex flex-col gap-5">
              <EditAgentField
                title="Agent Name"
                value={agent.name || ""}
                onSave={handleSaveChange("name")}
              >
                <h1 className="max-w-3/4 truncate text-4xl font-bold text-white">
                  {agent.name}
                </h1>
              </EditAgentField>
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
            <AgentInfo agent={agent} />
          </div>
          <div className="flex flex-col items-start gap-2 border-b border-gray-700 px-6 py-12 text-sm">
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
            <div className="flex w-1/2 flex-col items-start border-l border-gray-700 p-6">
              <span className="w-full text-left text-xs font-semibold uppercase text-gray-400">
                ELO
              </span>
              <span className="w-full text-left text-gray-300">
                Not rated yet
              </span>
            </div>
          </div>
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 border-b border-l border-r border-t border-gray-700 text-sm lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:grid-rows-3 lg:border-l-0">
          <div className="flex flex-col items-start gap-2 border-b border-gray-700 p-6 lg:row-span-2">
            <EditAgentField
              title="Agent Profile"
              value={agent.description || ""}
              onSave={handleSaveChange("description")}
            >
              <span className="font-semibold uppercase text-gray-400">
                agent description
              </span>
            </EditAgentField>
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
                      className="rounded border border-gray-700 px-2 py-1 text-white"
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
              handleSortChange={handleSortChange}
              sortState={sortState}
              competitions={agentCompetitionsData?.competitions || []}
            />
          </TabsContent>
          <TabsContent value="ongoing">
            <CompetitionTable
              handleSortChange={handleSortChange}
              sortState={sortState}
              competitions={agentCompetitionsData?.competitions.filter(
                (c) => c.status === CompetitionStatus.Active,
              )}
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <CompetitionTable
              handleSortChange={handleSortChange}
              sortState={sortState}
              competitions={agentCompetitionsData?.competitions.filter(
                (c) => c.status === CompetitionStatus.Pending,
              )}
            />
          </TabsContent>
          <TabsContent value="complete">
            <CompetitionTable
              handleSortChange={handleSortChange}
              sortState={sortState}
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
