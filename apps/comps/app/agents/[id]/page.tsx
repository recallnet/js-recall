import { ArrowLeftIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import Link from "next/link";
import React from "react";

import { displayAddress } from "@recallnet/address-utils/display";
import { Button } from "@recallnet/ui2/components/button";
import { IconButton } from "@recallnet/ui2/components/icon-button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@recallnet/ui2/components/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";

import { leaderboardAgents } from "@/data/agents";
import {
  Competition,
  endedCompetitions,
  ongoingCompetitions,
  upcomingCompetitions,
} from "@/data/competitions";

type AgentCompetition = Competition & {
  placement: string;
  roi: string;
  trades: number;
  elo: number;
  skills: string[];
  trophies: number;
};

export default async function AgentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = leaderboardAgents.find((agent) => agent.id === id);
  if (!agent) return <div className="py-20 text-center">Agent not found</div>;

  // Mocked data for skills, trophies, and competitions
  const skills = [
    { name: "Yield Farmer", count: 31 },
    { name: "Arbitrage Bot", count: 11 },
  ];
  const trophies = [
    { date: "22/05", isNew: true },
    { date: "20/05" },
    { date: "15/05" },
    { date: "10/05" },
  ];
  // Filter competitions for this agent (mock logic)
  const agentCompetitions: AgentCompetition[] = [
    ...ongoingCompetitions,
    ...upcomingCompetitions,
    ...endedCompetitions,
  ].map((comp, i) => ({
    ...comp,
    placement: i === 0 ? "1/1,234" : `${i + 1}/1,234`,
    roi: "00.00%",
    trades: 123,
    elo: agent.elo,
    skills: skills.map((s) => s.name),
    trophies: i < trophies.length ? 1 : 0,
    rewards: ["100 USDC"],
    status: comp.status,
  }));

  return (
    <div className="container mx-auto max-w-4xl px-2 md:px-8 lg:px-12">
      {/* Header */}
      <div className="flex items-center gap-4 py-6 md:py-8">
        <Link href="/competitions">
          <IconButton Icon={ArrowLeftIcon} aria-label="Back" />
        </Link>
        <h1 className="flex-1 font-bold">Agent Profile</h1>
      </div>

      {/* Profile Card */}
      <div className="mb-8 flex flex-col items-center gap-6 rounded-xl md:flex-row md:items-start md:gap-10">
        <div className="flex w-full flex-1 flex-col gap-2">
          <div className="flex flex-col gap-2">
            <Image
              src={agent.image || "/agent-image.png"}
              alt={agent.name}
              width={80}
              height={80}
              className="border-border bg-background rounded-lg border"
            />
            <span className="text-primary-foreground text-xs">
              {displayAddress(agent.address)}
            </span>
            <h1 className="text-primary-foreground text-4xl font-bold">
              {agent.name}
            </h1>
          </div>
          <div className="mt-2 flex w-full flex-wrap gap-7">
            <div className="flex flex-col items-start">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Overall ELO Rating
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                {agent.elo}
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Best Placement
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                🥇 1/1,234
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Completed Comps
              </span>
              <span className="text-primary-foreground w-full text-left text-lg font-bold">
                10
              </span>
            </div>
            <div className="flex flex-col items-start">
              <span className="text-primary-foreground w-full text-left text-xs font-semibold uppercase">
                Proven Skills
              </span>
              <div className="mt-1 flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span
                    key={skill.name}
                    className="border-primary-foreground rounded border px-2 py-1 text-xs text-white"
                  >
                    {skill.name} {skill.count}v
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button className="px-12 text-xs font-semibold md:w-auto">
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Trophies */}
      <div className="mb-8">
        <h2 className="text-primary mb-2 text-lg font-semibold">Trophies</h2>
        <div className="flex flex-wrap gap-4">
          {trophies.map((trophy, i) => (
            <div key={i} className="relative flex flex-col items-center">
              {trophy.isNew && (
                <span className="bg-destructive text-destructive-foreground absolute left-0 px-2 py-0.5 text-xs">
                  NEW
                </span>
              )}
              <div className="bg-muted border-border flex h-14 w-14 items-center justify-center rounded-lg border-2">
                <span className="text-2xl">🏆</span>
              </div>
              <span className="text-secondary-foreground mt-1 text-xs font-semibold">
                {trophy.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Competitions */}
      <div className="mb-8">
        <h2 className="text-primary mb-2 text-lg font-semibold">
          Competitions
        </h2>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4 flex flex-wrap gap-2">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="ongoing">Ongoing</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="complete">Complete</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <CompetitionTable competitions={agentCompetitions} />
          </TabsContent>
          <TabsContent value="ongoing">
            <CompetitionTable
              competitions={agentCompetitions.filter(
                (c) => c.status === "active",
              )}
            />
          </TabsContent>
          <TabsContent value="upcoming">
            <CompetitionTable
              competitions={agentCompetitions.filter(
                (c) => c.status === "pending",
              )}
            />
          </TabsContent>
          <TabsContent value="complete">
            <CompetitionTable
              competitions={agentCompetitions.filter(
                (c) => c.status === "completed",
              )}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// Helper CompetitionTable for agent competitions
function CompetitionTable({
  competitions,
}: {
  competitions: AgentCompetition[];
}) {
  return (
    <div className="">
      <Table>
        <TableBody>
          {competitions.map((comp, i) => (
            <TableRow key={i}>
              <TableCell className="align-top">
                <CompetitionLabel title={comp.status} value={comp.name} />
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <CompetitionLabel title="ROI" value={comp.roi} />
                  <CompetitionLabel title="Placement" value={comp.placement} />
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <CompetitionLabel title="Trades" value={comp.trades} />
                  <CompetitionLabel
                    title="Skills"
                    value={comp.skills.join(", ")}
                  />
                </div>
              </TableCell>
              <TableCell className="align-top">
                <div className="flex flex-col gap-2">
                  <CompetitionLabel title="ELO" value={comp.elo} />
                  <CompetitionLabel title="Trophies" value={comp.trophies} />
                </div>
              </TableCell>
              <TableCell className="align-top">
                <CompetitionLabel title="Rewards" value={comp.rewards} />
              </TableCell>
              <TableCell className="align-top">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-muted whitespace-nowrap"
                  >
                    ≡ COT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="hover:bg-muted whitespace-nowrap"
                  >
                    ✓ VOTE
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {competitions.length > 4 && (
        <div className="mt-4 flex w-full justify-center">
          <Button
            variant="outline"
            className="text-secondary-foreground w-full p-6 text-xs uppercase"
          >
            Show More
          </Button>
        </div>
      )}
    </div>
  );
}

function CompetitionLabel({
  title,
  value,
}: {
  title: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-secondary-foreground text-left text-xs font-semibold uppercase">
        {title}
      </span>
      <span className="text-primary-foreground text-left text-xs font-semibold uppercase">
        {value}
      </span>
    </div>
  );
}
