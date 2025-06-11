"use client";

import {Share2Icon} from "lucide-react";
import {SquarePen} from "lucide-react";
import React from "react";

import {Button} from "@recallnet/ui2/components/button";
import Card from "@recallnet/ui2/components/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@recallnet/ui2/components/dialog";
import {Input} from "@recallnet/ui2/components/input";
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

import {BreadcrumbNav} from "@/components/breadcrumb-nav";
import {Hexagon} from "@/components/hexagon";
import MirrorImage from "@/components/mirror-image";
import {useUpdateAgent} from "@/hooks";
import {useAgent} from "@/hooks/useAgent";
import {useAgentCompetitions} from "@/hooks/useAgentCompetitions";
import {Competition, CompetitionStatus, CrossChainTradingType} from "@/types";

export default function UserAgent({id}: {id: string}) {
  const {
    data: agent,
    isLoading: isLoadingAgent,
    error: agentError,
  } = useAgent(id);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [image, setImage] = React.useState(
    agent?.imageUrl || "/agent-placeholder.png",
  );
  const [inputImage, setInputImage] = React.useState("");
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

  const skills = agent?.stats?.skills || [];
  const trophies = (agent?.metadata?.trophies || []) as string[];

  const {data: agentCompetitionsData, isLoading: isLoadingCompetitions} =
    useAgentCompetitions(id, {sort: sortString});

  const handleSortChange = React.useCallback((field: string) => {
    setSorted((sort) => {
      const cur = sort[field];
      const nxt =
        !cur || cur == "none" ? "asc" : cur == "asc" ? "desc" : "none";
      return {...sort, [field]: nxt};
    });
  }, []);

  const handleSave = async () => {
    if (!agent) return;

    try {
      await updateAgent.mutateAsync({
        agentId: agent.id,
        params: {
          imageUrl: inputImage,
        },
      });
    } catch (error) {
      console.error("Failed to update agent:", error);
    }

    setImage(inputImage);
    setDialogOpen(false);
  };

  React.useEffect(() => {
    if (dialogOpen) setInputImage(inputImage);
  }, [dialogOpen, inputImage]);

  if (isLoadingAgent || isLoadingCompetitions)
    return <div className="py-20 text-center">Loading agent data...</div>;
  if (agentError || !agent)
    return <div className="py-20 text-center">Agent not found</div>;

  return (
    <>
      <BreadcrumbNav
        items={[
          {label: "RECALL", href: "/"},
          {label: "AGENTS", href: "/competitions"},
          {label: agent.name, href: "/"},
        ]}
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
          <MirrorImage image={image} width={160} height={160}>
            <div
              className="bg-card absolute flex h-full w-full cursor-pointer flex-col justify-center overflow-hidden rounded-full px-3 opacity-0 transition-all duration-300 hover:opacity-100"
              onClick={() => setDialogOpen(true)}
            >
              <div className="flex items-center gap-2 px-2 py-4">
                <SquarePen className="text-secondary-foreground mr-2 inline-block" />
                <span className="text-xs font-medium">Agent Picture URL</span>
              </div>
            </div>
          </MirrorImage>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Agent Picture URL</DialogTitle>
              </DialogHeader>
              <div className="mt-2 flex flex-col gap-2">
                <Input
                  id="profile-url"
                  type="url"
                  placeholder="https://example.com/avatar.png"
                  value={inputImage}
                  onChange={(e) => setInputImage(e.target.value)}
                  autoFocus
                />
                <span className="text-secondary-foreground mt-1 text-xs">
                  Public PNG/JPG · Square ≥ 256 × 256 px
                </span>
              </div>
              <DialogFooter className="mt-4">
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="modal"
                  onClick={handleSave}
                  disabled={!inputImage || inputImage === image}
                >
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <span className="w-50 mt-20 text-center text-lg text-gray-400">
            Calm accumulation of elite assets.
          </span>
        </Card>
        <div className="flex-2 xs:col-span-2 xs:col-start-2 xs:row-start-1 xs:mt-0 xs:h-[65vh] col-span-3 row-start-2 mt-5 flex shrink flex-col border border-gray-700 lg:col-span-1 lg:col-start-2">
          <div className="grow border-b border-gray-700 p-8">
            <h1 className="truncate text-4xl font-bold text-white">
              {agent.name}
            </h1>
            <div className="mt-5 flex w-full gap-3">
              <span className="text-xl font-semibold text-gray-400">
                Developed by
              </span>
              <span className="truncate text-xl font-semibold text-gray-400 text-white">
                {agent.name}
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
                {0}
              </span>
            </div>
            <div className="flex w-1/2 flex-col items-start border-l border-gray-700 p-6">
              <span className="w-full text-left text-xs font-semibold uppercase text-gray-400">
                ELO Rating
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {0}
              </span>
            </div>
          </div>
        </div>
        <div className="xs:grid col-span-3 row-start-2 mt-8 hidden grid-rows-2 border-b border-l border-r border-t border-gray-700 text-sm lg:col-start-3 lg:row-start-1 lg:mt-0 lg:h-[65vh] lg:grid-rows-3 lg:border-l-0">
          <div className="flex flex-col items-start gap-2 border-b border-gray-700 p-6 lg:row-span-2">
            <EditAgentField title='Agent Profile' value={agent.description || ''} onSave={handleSaveChange('description')}>
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

function CompetitionTable({
  competitions,
  handleSortChange,
  sortState,
}: {
  competitions: Competition[] | undefined;
  handleSortChange: (field: string) => void;
  sortState: Record<string, SortState>;
}) {
  competitions = [
    {
      id: "lksdjf",
      name: "name",
      description: "some fuckin desc",
      externalUrl: "/",
      imageUrl: "/",
      type: "trading",
      status: CompetitionStatus.Active,
      crossChainTradingType: CrossChainTradingType.Allow,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  return (
    <div className="overflow-hidden rounded border border-gray-800">
      <Table>
        <TableHeader className="text-muted-foreground bg-gray-900 text-xs uppercase">
          <TableRow className="grid w-full grid-cols-8">
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
            <TableHead>Trophies</TableHead>
            <TableHead className="text-left">Reward</TableHead>
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
                <TableRow key={i} className="grid grid-cols-8">
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
                  <TableCell className="align-center h-25 flex items-center gap-2">
                    <Button className="rounded bg-sky-700 px-7">Claim</Button>
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
                <TableRow key={i}>{/* Same structure */}</TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
