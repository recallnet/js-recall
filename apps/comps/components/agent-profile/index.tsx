"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import Card from "@recallnet/ui2/components/card";
import { SortState } from "@recallnet/ui2/components/table";
import { Tabs, TabsList, TabsTrigger } from "@recallnet/ui2/components/tabs";
import { toast } from "@recallnet/ui2/components/toast";
import Tooltip from "@recallnet/ui2/components/tooltip";
import { cn } from "@recallnet/ui2/lib/utils";

import { Trophy, TrophyBadge } from "@/components/trophy-badge";
import { config } from "@/config/public";
import { useUpdateAgent, useUserAgents } from "@/hooks";
import { useAgentCompetitions } from "@/hooks/useAgentCompetitions";
import {
  useSandboxAgentApiKey,
  useUpdateSandboxAgent,
} from "@/hooks/useSandbox";
import type { RouterOutputs } from "@/rpc/router";
import { displayAddress } from "@/utils/address";
import { formatCompetitionType } from "@/utils/competition-utils";

import BigNumberDisplay from "../bignumber";
import { BreadcrumbNav } from "../breadcrumb-nav";
import { Clipboard } from "../clipboard";
import { AgentHandleSchema } from "../create-agent";
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
  agent: RouterOutputs["agent"]["getAgent"]["agent"];
  owner: RouterOutputs["agent"]["getAgent"]["owner"];
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
  setStatus: (status: string) => void;
  status: string;
}) {
  const [offset, setOffset] = React.useState(0);
  const skills = agent?.skills || [];
  const trophies = sortTrophies((agent.trophies || []) as Trophy[]);

  // Ranks are pre-sorted server-side (ordered by rank & ties are also accounted for)
  const ranks = agent.stats.ranks || [];
  const topRank = ranks[0];

  const { data: userAgents } = useUserAgents({ limit: 100 });
  const isUserAgent = userAgents?.agents.some((a) => a.id === id) || false;
  const updateAgent = useUpdateAgent();

  // Sandbox hooks for syncing agent updates
  const { data: sandboxAgentData } = useSandboxAgentApiKey(
    isUserAgent && config.publicFlags.enableSandbox
      ? agent?.handle || null
      : null,
  );
  const updateSandboxAgent = useUpdateSandboxAgent();

  const sortString = React.useMemo(() => {
    return Object.entries(sortState).reduce((acc, [key, sort]) => {
      if (sort !== "none") return acc + `${sort == "asc" ? "" : "-"}${key}`;
      return acc;
    }, "");
  }, [sortState]);

  const handleSaveChange =
    (field: "imageUrl" | "description" | "name" | "handle" | "skills") =>
    async (value: unknown) => {
      if (!agent) return;

      if (field === "handle") {
        const handle = value as string;
        const result = AgentHandleSchema.safeParse(handle);
        if (!result.success) {
          const errorMessage =
            result.error.errors[0]?.message ||
            "Handle can only contain lowercase letters, numbers, and underscores";
          toast.error(errorMessage);
          // Throw error to prevent field from updating
          throw new Error(errorMessage);
        }
      }

      // Update in main environment
      try {
        const updateData =
          field === "skills"
            ? { metadata: { skills: value as string[] } }
            : { [field]: value };

        await updateAgent.mutateAsync({
          agentId: agent.id,
          ...updateData,
        });
      } catch (error) {
        console.error("Failed to update agent:", error);
        toast.error("Failed to update agent", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        throw error;
      }

      try {
        // Special handling for name changes since we *must* need the names to match across environments
        if (
          (field === "name" || field === "handle") &&
          config.publicFlags.enableSandbox &&
          sandboxAgentData?.agent?.id
        ) {
          // Update in sandbox first
          try {
            await updateSandboxAgent.mutateAsync({
              agentId: sandboxAgentData.agent.id,
              params: {
                name: field === "name" ? (value as string) : agent.name,
                handle: field === "handle" ? (value as string) : agent.handle,
              },
            });
          } catch (sandboxError) {
            console.error(
              "Failed to update agent name in sandbox:",
              sandboxError,
            );

            throw sandboxError;
          }
        }

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

  type Competition = NonNullable<typeof compsData>["competitions"][number];

  const competitions = React.useMemo(() => {
    return (
      compsData?.competitions.map((comp: Competition) => ({
        ...comp,
        trophies: trophies.filter((t) => t.competitionId === comp.id),
      })) || []
    );
  }, [compsData?.competitions, trophies]);

  return (
    <>
      <BreadcrumbNav
        items={[
          { label: "HOME", href: "/" },
          { label: "AGENTS", href: isUserAgent ? "/profile" : "/" },
          { label: agent.name },
        ]}
      />

      <div className="xs:grid-rows-[550px_1fr] my-6 grid grid-cols-[300px_1fr_1fr] rounded-xl md:grid-cols-[400px_1fr_1fr]">
        <Card
          className="xs:col-span-1 xs:mr-8 relative col-span-3 flex h-[550px] flex-col border bg-[#11121A]"
          corner="top-left"
          cropSize={45}
        >
          <div className="absolute right-10 top-10 z-20 flex w-full justify-end">
            <ShareModal
              url={`${config.frontendUrl}/agents/${agent.id}`}
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
              "flex-1",
              agent?.imageUrl
                ? "relative w-full"
                : "relative flex w-full items-center justify-center",
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
                width={agent.imageUrl ? undefined : 200}
                height={agent.imageUrl ? undefined : 200}
                className={cn(
                  agent.imageUrl ? "absolute z-0 object-cover" : "w-50 h-50",
                )}
              />
            )}
          </div>
          {agent.walletAddress && (
            <div className="flex justify-center border-t bg-black px-6 py-3 text-center">
              <Clipboard
                text={displayAddress(agent.walletAddress, { numChars: 6 })}
                textOnCopy={agent.walletAddress}
                className="text-secondary-foreground px-3 py-2 font-mono text-lg"
                showBorder={false}
              />
            </div>
          )}
        </Card>
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 col-span-3 row-start-2 mt-5 flex shrink flex-col rounded-xl border lg:col-span-1 lg:col-start-2 lg:rounded-r-none">
          <div className="relative flex w-full grow flex-col border-b p-6">
            {/* Display best rank with tooltip showing all ranks */}
            <div className="flex gap-3 font-mono text-lg font-semibold">
              {ranks.length > 0 && topRank ? (
                <>
                  <Tooltip
                    content={
                      <div className="space-y-2 p-2">
                        {ranks.map((rankData) => (
                          <div
                            key={rankData.type}
                            className="flex items-center justify-between gap-4"
                          >
                            <span className="text-secondary-foreground text-xs font-semibold uppercase">
                              {formatCompetitionType(rankData.type)}
                            </span>
                            <div className="flex items-center gap-2 font-mono text-sm">
                              <span className="text-primary-foreground font-bold">
                                <BigNumberDisplay
                                  decimals={0}
                                  value={rankData.score.toString()}
                                  displayDecimals={0}
                                  compact={false}
                                />
                              </span>
                              <span className="text-secondary-foreground font-bold">
                                #{rankData.rank}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    }
                  >
                    <span className="cursor-help">
                      <BigNumberDisplay
                        decimals={0}
                        value={topRank.score.toString()}
                        displayDecimals={0}
                        compact={false}
                      />
                      <span className="text-secondary-foreground ml-3">
                        #{topRank.rank}
                      </span>
                    </span>
                  </Tooltip>
                </>
              ) : (
                <span className="text-secondary-foreground text-sm">
                  No global rankings yet
                </span>
              )}
            </div>
            {isUserAgent ? (
              <div>
                <EditAgentField
                  title="Agent Name"
                  value={agent.name || ""}
                  onSave={handleSaveChange("name")}
                >
                  <>
                    <h1 className="text-primary-foreground max-w-[90%] truncate text-4xl font-bold">
                      {agent.name}
                    </h1>
                    <AgentVerifiedBadge
                      verified={Boolean(agent.walletAddress)}
                    />
                  </>
                </EditAgentField>
              </div>
            ) : (
              <div>
                <h1 className="text-primary-foreground flex w-full items-center gap-2 text-4xl font-bold">
                  <span className="truncate">{agent.name}</span>
                  <AgentVerifiedBadge verified={Boolean(agent.walletAddress)} />
                </h1>
              </div>
            )}

            {/* Agent Handle */}
            {isUserAgent ? (
              <EditAgentField
                title="Agent Handle"
                value={agent.handle || ""}
                onSave={handleSaveChange("handle")}
              >
                <span className="text-secondary-foreground max-w-[90%] truncate text-2xl font-semibold">
                  @{agent.handle}
                </span>
              </EditAgentField>
            ) : (
              <span className="text-secondary-foreground max-w-[90%] truncate text-2xl font-semibold">
                @{agent.handle}
              </span>
            )}

            {!isUserAgent && (
              <div className="mt-5 flex w-full gap-1 text-nowrap">
                <span className="text-secondary-foreground text-lg font-normal">
                  Developed by
                </span>
                <span className="text-primary-foreground truncate text-lg font-normal">
                  [{owner?.name}]
                </span>
              </div>
            )}

            <div
              className={cn(
                "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary-foreground/30 hover:scrollbar-thumb-secondary-foreground/50 mt-3 w-full overflow-y-auto overflow-x-hidden py-2",
                isUserAgent ? "h-[70px]" : "h-[136px]",
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
                    This agent hasn&apos;t earned trophies yet.
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex h-[99px] w-full border-b">
            <div className="flex flex-1 flex-col items-start gap-2 px-6 py-6">
              <span className="text-secondary-foreground w-full text-nowrap text-left font-mono text-sm font-semibold uppercase tracking-wide">
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
              <span className="text-secondary-foreground w-full text-nowrap text-left font-mono text-sm font-semibold uppercase tracking-wide">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-semibold">
                {agent.stats.completedCompetitions}
              </span>
            </div>
            {/* TODO: Re-implement with boosts */}
            {/* <div className="flex w-1/2 flex-col items-start border-l p-5">
              <span className="text-secondary-foreground w-full text-nowrap text-left font-mono text-sm font-semibold uppercase tracking-wide">
                Total Boosts
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-semibold">
                {agent.stats.totalVotes?.toLocaleString() || "0"}
              </span>
            </div> */}
          </div>
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 rounded-xl border-b border-l border-r border-t text-xs lg:col-start-3 lg:row-start-1 lg:mt-0 lg:grid-rows-3 lg:rounded-l-none lg:border-l-0">
          <div className="flex flex-col items-start border-b p-6">
            {isUserAgent ? (
              <EditAgentField
                useTextarea
                title="Agent Profile"
                value={agent.description || ""}
                onSave={handleSaveChange("description")}
              >
                <span className="text-secondary-foreground font-mono text-sm font-semibold uppercase tracking-wide">
                  agent description
                </span>
              </EditAgentField>
            ) : (
              <span className="text-secondary-foreground font-mono text-sm font-semibold uppercase tracking-wide">
                agent description
              </span>
            )}
            <div className="scrollbar-thin scrollbar-track-transparent scrollbar-thumb-secondary-foreground/30 hover:scrollbar-thumb-secondary-foreground/50 mt-2 max-h-[120px] w-full overflow-y-auto pr-2">
              <span className="text-primary-foreground break-words text-base">
                {agent.description || "No profile created yet"}
              </span>
            </div>
          </div>
          <div
            className={cn(
              "flex flex-col items-start p-6",
              agent.skills && agent.skills?.length > 4 ? "" : "lg:row-span-2",
            )}
          >
            {isUserAgent ? (
              <EditSkillsField
                title="Agent Skills"
                value={agent.skills || []}
                onSave={handleSaveChange("skills")}
              >
                <span className="text-secondary-foreground text-left font-mono text-sm font-semibold uppercase tracking-wide">
                  Agent Skills
                </span>
              </EditSkillsField>
            ) : (
              <span className="text-secondary-foreground text-left font-mono text-sm font-semibold uppercase tracking-wide">
                Agent Skills
              </span>
            )}
            <div
              className={cn(
                "text-secondary-foreground mt-3 gap-3 break-words",
                skills.length > 0 ? "grid grid-cols-2" : "flex flex-wrap",
              )}
            >
              {skills.length > 0 ? (
                skills.map((skill, index) => (
                  <span
                    key={index}
                    className="text-primary-foreground truncate rounded border px-2 py-1 text-base"
                  >
                    {skill}
                  </span>
                ))
              ) : (
                <span className="text-base">
                  This agent hasn&apos;t showcased skills yet.
                </span>
              )}
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
          <Credentials
            agent={agent}
            userWalletAddress={owner?.walletAddress}
            className="mt-6"
          />
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
