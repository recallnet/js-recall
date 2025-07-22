"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import Card from "@recallnet/ui2/components/card";
import { SortState } from "@recallnet/ui2/components/table";
import { Tabs, TabsList, TabsTrigger } from "@recallnet/ui2/components/tabs";
import Tooltip from "@recallnet/ui2/components/tooltip";
import { toast } from "@recallnet/ui2/components/toast";
import { cn } from "@recallnet/ui2/lib/utils";

import { Trophy, TrophyBadge } from "@/components/trophy-badge";
import { DISABLE_LEADERBOARD, ENABLE_SANDBOX } from "@/config";
import { useUpdateAgent, useUserAgents } from "@/hooks";
import { useAgentCompetitions } from "@/hooks/useAgentCompetitions";
import {
  useSandboxAgentApiKey,
  useUpdateSandboxAgent,
} from "@/hooks/useSandbox";
import { Agent, AgentWithOwnerResponse, Competition } from "@/types";

import BigNumberDisplay from "../bignumber";
import { BreadcrumbNav } from "../breadcrumb-nav";
import { Clipboard } from "../clipboard";
import { ShareModal } from "../share-modal/index";
import { AgentImage } from "./agent-image";
import AgentBestPlacement from "./best-placement";
import CompetitionTable from "./comps-table";
import Credentials from "./credentials";
import { EditAgentField } from "./edit-field";
import { EditSkillsField } from "./edit-skills-field";
import { AgentVerifiedBadge } from "./verify-badge";

function sortTrophies(items: Trophy[]): Trophy[] {
  return items.sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const limit = 10;

export default function AgentProfile({
  id,
  agent,
  owner,
  handleSortChange,
  sortState,
  status,
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
  const [offset, setOffset] = React.useState(0);
  const skills = agent?.skills || [];
  const trophies = sortTrophies((agent.trophies || []) as Trophy[]);

  const { data: userAgents } = useUserAgents({ limit: 100 });
  const isUserAgent = userAgents?.agents.some((a) => a.id === id) || false;
  const updateAgent = useUpdateAgent();

  // Sandbox hooks for syncing agent updates
  const { data: sandboxAgentData } = useSandboxAgentApiKey(
    isUserAgent && ENABLE_SANDBOX ? agent?.name || null : null,
  );
  const updateSandboxAgent = useUpdateSandboxAgent();

  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const handleSaveChange =
    (field: "imageUrl" | "description" | "name" | "skills") =>
    async (value: unknown) => {
      if (!agent) return;

      try {
        // Special handling for name changes since we *must* need the names to match across environments
        if (field === "name" && ENABLE_SANDBOX && sandboxAgentData?.agent?.id) {
          // Update in sandbox first
          try {
            await updateSandboxAgent.mutateAsync({
              agentId: sandboxAgentData.agent.id,
              name: value as string,
            });
          } catch (sandboxError) {
            console.error(
              "Failed to update agent name in sandbox:",
              sandboxError,
            );
            
            .error("Failed to update agent name in sandbox environment", {
              description: "The name was not updated. Please try again.",
            });
            return;
          }
        }

        // Update in main environment
        await updateAgent.mutateAsync({
          agentId: agent.id,
          params:
            field === "skills"
              ? { metadata: { skills: value as string[] } }
              : {
                  [field]: value,
                },
        });

        toast.success("Agent updated successfully");
      } catch (error) {
        console.error("Failed to update agent:", error);
      }
    };

  const options = {
    sort: sortString,
    limit,
    offset,
  };
  const { data: compsData } = useAgentCompetitions(
    id,
    status === "all" ? options : { ...options, status },
  );
  const { total } = compsData?.pagination || { total: 0 };

  const competitions: (Competition & { trophies: Trophy[] })[] =
    React.useMemo(() => {
      return (
        compsData?.competitions.map((comp) => ({
          ...comp,
          trophies: trophies.filter((t) => t.competitionId === comp.id),
        })) || []
      );
    }, [compsData?.competitions, trophies]);

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: "RECALL", href: "/" },
          { label: "AGENTS", href: "/" },
          { label: agent.name },
        ]}
        className="mb-10"
      />

      <div className="xs:grid-rows-[550px_1fr] my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl md:grid-cols-[400px_1fr_1fr]">
        <Card
          className="xs:col-span-1 xs:mr-8 between relative col-span-3 h-[550px] bg-[#11121A]"
          corner="top-left"
          cropSize={45}
        >
          <div className="absolute right-10 top-10 flex w-full justify-end">
            <ShareModal
              url={`https://app.recall.network/agents/${agent.id}`}
              title="Share Agent"
              subtitle={
                <p className="text-muted-foreground text-sm">
                  Share this agent on
                </p>
              }
            />
          </div>
          <div
            className={cn(
              agent?.imageUrl
                ? "relative h-full w-full"
                : "relative flex h-full w-full items-center justify-center",
            )}
          >
            {isUserAgent ? (
              <AgentImage
                agentImage={agent?.imageUrl}
                onSave={handleSaveChange("imageUrl")}
              />
            ) : (
              <Image
                src={agent.imageUrl || "/agent-placeholder.png"}
                alt={agent.name}
                fill={!!agent.imageUrl}
                width={agent.imageUrl ? undefined : 50}
                height={agent.imageUrl ? undefined : 50}
                className={cn(
                  agent.imageUrl ? "absolute z-0 object-cover" : "w-50 h-50",
                )}
              />
            )}
          </div>
          {agent.walletAddress && (
            <div className="px-15 xs:px-10 absolute bottom-0 right-[50%] z-20 w-full translate-x-[50%] border bg-black py-3 md:px-20">
              <Clipboard
                text={agent.walletAddress || ""}
                className="text-secondary-foreground w-full rounded-[10px] border-gray-700 px-3 py-2 text-lg hover:text-gray-300"
              />
            </div>
          )}
        </Card>
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 col-span-3 row-start-2 mt-5 flex shrink flex-col border lg:col-span-1 lg:col-start-2">
          <div className="relative flex w-full grow flex-col border-b p-6">
            <div className="flex gap-3 font-bold">
              {agent.stats.score > 0 && (
                <Tooltip content="Global Score">
                  <BigNumberDisplay
                    decimals={0}
                    value={agent.stats.score.toString()}
                    displayDecimals={0}
                    compact={false}
                  />
                </Tooltip>
              )}
              {agent.stats.rank && (
                <Tooltip content="Global Rank">
                  <span className="text-secondary-foreground">
                    #{agent.stats.rank}
                  </span>
                </Tooltip>
              )}
            </div>
            {isUserAgent ? (
              <EditAgentField
                title="Agent Name"
                value={agent.name || ""}
                onSave={handleSaveChange("name")}
              >
                <>
                  <h1 className="text-primary-foreground max-w-[90%] truncate text-4xl font-bold">
                    {agent.name}
                  </h1>
                  <AgentVerifiedBadge verified={Boolean(agent.walletAddress)} />
                </>
              </EditAgentField>
            ) : (
              <h1 className="text-primary-foreground flex w-full items-center gap-2 text-4xl font-bold">
                <span className="truncate">{agent.name}</span>
                <AgentVerifiedBadge verified={Boolean(agent.walletAddress)} />
              </h1>
            )}
            {!isUserAgent && (
              <div className="mt-5 flex w-full gap-1 text-nowrap">
                <span className="text-secondary-foreground text-xl font-semibold">
                  Developed by
                </span>
                <span className="text-primary-foreground truncate text-xl font-semibold">
                  [{owner?.name}]
                </span>
              </div>
            )}

            <div
              className={cn(
                "mt-3 min-h-40 w-full overflow-y-auto overflow-x-visible py-2",
                isUserAgent ? "max-h-[70px]" : "h-[150px] max-h-[136px]",
                trophies.length > 0 && "px-2",
              )}
            >
              <div className="flex flex-wrap justify-start gap-x-5 gap-y-4">
                {trophies.length > 0 ? (
                  trophies.map((trophy, i: number) => (
                    <TrophyBadge key={i} trophy={trophy} />
                  ))
                ) : (
                  <span className="text-secondary-foreground">
                    This agent hasn’t earned trophies yet.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex h-[99px] w-full border-b">
            <div className="flex flex-1 flex-col items-start gap-2 border-r px-6 py-6 text-xs">
              <span className="text-secondary-foreground w-full text-nowrap text-left font-semibold uppercase">
                Best Placement
              </span>
              <AgentBestPlacement
                rank={agent.stats.bestPlacement?.rank}
                places={agent.stats.bestPlacement?.totalAgents}
              />
            </div>
          </div>
          <div className="flex w-full">
            <div className="flex w-1/2 flex-col items-start p-5">
              <span className="text-secondary-foreground w-full truncate text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.stats.completedCompetitions}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start border-l p-5">
              <span className="text-secondary-foreground w-full text-nowrap text-left text-xs font-semibold uppercase">
                Agent Rank
              </span>
              <span className="text-secondary-foreground mt-1 w-full text-left text-sm">
                {DISABLE_LEADERBOARD ? "TBA" : agent.stats.rank}
              </span>
            </div>
          </div>
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 border-b border-l border-r border-t text-xs lg:col-start-3 lg:row-start-1 lg:mt-0 lg:grid-rows-3 lg:border-l-0">
          <div
            className={cn(
              "flex flex-col items-start gap-2 border-b p-6",
              agent.skills && agent.skills?.length > 4 ? "" : "lg:row-span-2",
            )}
          >
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
            <span className="text-primary-foreground break-all">
              {agent.description || "No profile created yet"}
            </span>
          </div>
          <div className="flex flex-col items-start p-6">
            {isUserAgent ? (
              <EditSkillsField
                title="Agent Skills"
                value={agent.skills || []}
                onSave={handleSaveChange("skills")}
              >
                <span className="text-secondary-foreground text-left font-semibold uppercase">
                  Agent Skills
                </span>
              </EditSkillsField>
            ) : (
              <span className="text-secondary-foreground text-left font-semibold uppercase">
                Agent Skills
              </span>
            )}
            <div
              className={cn(
                "text-secondary-foreground mt-3 gap-3 break-all",
                skills.length > 0 ? "grid grid-cols-2" : "flex flex-wrap",
              )}
            >
              {skills.length > 0
                ? skills.map((skill, index) => (
                    <span
                      key={index}
                      className="text-primary-foreground truncate rounded border px-2 py-1"
                    >
                      {skill}
                    </span>
                  ))
                : "This agent hasn't showcased skills yet."}
            </div>
          </div>
        </div>
      </div>

      {isUserAgent && (
        <div className="mb-8 flex flex-col border p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="text-secondary-foreground text-left font-semibold uppercase">
              Credentials
            </span>
            <Link
              href="https://docs.recall.network/competitions/guides/register#verifying-your-account"
              target="_blank"
              className="text-primary-foreground flex items-center gap-1 underline"
            >
              Docs <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
          <Credentials agent={agent} className="mt-6" />
        </div>
      )}

      {/* Competitions */}
      <div className="mb-8">
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
              value="active"
              className={cn(
                "rounded border border-green-500 p-2",
                status === "active"
                  ? "text-primary-foreground bg-green-500"
                  : "text-green-500",
              )}
            >
              Ongoing
            </TabsTrigger>
            <TabsTrigger
              value="pending"
              className={cn(
                "rounded border border-blue-500 p-2 text-black",
                status === "pending"
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
            total={total}
            onLoadMore={() => setOffset((prev: number) => prev + limit)}
            handleSortChange={handleSortChange}
            sortState={sortState}
            canClaim={isUserAgent}
            competitions={competitions || []}
          />
        </Tabs>
      </div>
    </>
  );
}
