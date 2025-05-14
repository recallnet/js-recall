"use client";

import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Github, Twitter } from "lucide-react";
import { useState } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";
import { Input } from "@recallnet/ui/components/shadcn/input";

import { getAllTeams } from "@/lib/api";

/**
 * Agent list component for displaying all registered agents
 *
 * @returns Agent list component
 */
export function AgentList() {
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all teams
  const {
    data: teams,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      console.log("Fetching teams from API");
      const result = await getAllTeams();
      console.log("Teams API result:", result);
      return result;
    },
    staleTime: 60 * 1000, // Consider data stale after 1 minute
    refetchOnMount: true, // Refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });

  // Filter teams with at least one agent that matches the search query
  const filteredTeams = teams
    ? teams.filter((team) => {
        const query = searchQuery.toLowerCase();
        if (query === "") return true;

        // Check if team name matches
        if (team.name.toLowerCase().includes(query)) return true;

        // Check if any agent metadata matches
        if (team.metadata && team.metadata.length > 0) {
          return team.metadata.some(
            (agent) =>
              // Check agent name
              (agent.name && agent.name.toLowerCase().includes(query)) ||
              // Check agent description
              (agent.description &&
                agent.description.toLowerCase().includes(query)) ||
              // Check agent version
              (agent.version && agent.version.toLowerCase().includes(query)) ||
              // Check agent url
              (agent.url && agent.url.toLowerCase().includes(query)) ||
              // Check agent social info
              (agent.social &&
                ((agent.social.twitter &&
                  agent.social.twitter.toLowerCase().includes(query)) ||
                  (agent.social.email &&
                    agent.social.email.toLowerCase().includes(query)) ||
                  (agent.social.github &&
                    agent.social.github.toLowerCase().includes(query)) ||
                  (agent.social.discord &&
                    agent.social.discord.toLowerCase().includes(query)) ||
                  (agent.social.telegram &&
                    agent.social.telegram.toLowerCase().includes(query)))) ||
              // Check agent skills
              (agent.skills &&
                agent.skills.some(
                  (skill) =>
                    (skill.type && skill.type.toLowerCase().includes(query)) ||
                    (skill.customSkill &&
                      skill.customSkill.toLowerCase().includes(query)),
                )),
          );
        }

        return false;
      })
    : [];

  // Handle search change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Format GitHub URL
  const formatGitHubUrl = (url?: string): string | undefined => {
    if (!url) return undefined;

    // Check if it's a GitHub URL
    if (url.includes("github.com")) {
      return url;
    }

    // Handle github.com/username/repo format without http
    if (url.startsWith("github.com/")) {
      return `https://${url}`;
    }

    return url;
  };

  // If loading
  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">Loading agents...</p>
        </CardContent>
      </Card>
    );
  }

  // If error
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error loading agents</CardTitle>
          <CardDescription>
            There was a problem loading the agent registry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Please try again later.</p>
        </CardContent>
      </Card>
    );
  }

  // If no teams
  if (!teams || teams.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No agents registered</CardTitle>
          <CardDescription>
            There are no agents registered in the system yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Be the first to register your agent!</p>
        </CardContent>
      </Card>
    );
  }

  // Count total agents across all teams
  const totalAgents = teams.reduce(
    (count, team) => count + (team.metadata ? team.metadata.length : 0),
    0,
  );

  // Count displayed agents across filtered teams
  const displayedAgents = filteredTeams.reduce(
    (count, team) => count + (team.metadata ? team.metadata.length : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search agents by name, team, description..."
          className="max-w-md"
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <div className="text-muted-foreground text-sm">
          Showing {displayedAgents} of {totalAgents} registered agents
        </div>
      </div>

      <div className="space-y-4">
        {filteredTeams.map(
          (team) =>
            team.metadata &&
            team.metadata.map((agent, agentIndex) => (
              <Card
                key={`${team.id}-${agentIndex}`}
                className="overflow-hidden"
              >
                <div className="bg-muted/40 border-b px-6 py-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">
                      {agent.name || "Unnamed Agent"}
                      <span className="text-muted-foreground ml-2 text-sm">
                        by {team.name}
                      </span>
                    </h3>
                    <div className="text-muted-foreground text-sm">
                      Registered:{" "}
                      {new Date(team.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <CardContent className="p-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    {/* Agent Information */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                          AGENT INFORMATION
                        </h4>

                        <h3 className="text-xl font-semibold">
                          {agent.name || "Unnamed Agent"}
                          {agent.version && (
                            <span className="text-muted-foreground ml-2 text-sm font-normal">
                              v{agent.version}
                            </span>
                          )}
                        </h3>

                        {agent.url && (
                          <a
                            href={formatGitHubUrl(agent.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary mt-1 inline-flex items-center gap-1.5 text-sm"
                          >
                            {agent.url.includes("github") ? (
                              <Github size={14} />
                            ) : (
                              <ExternalLink size={14} />
                            )}
                            {agent.url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </div>

                      {agent.social && (
                        <div>
                          <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                            SOCIAL
                          </h4>
                          <div className="space-y-1">
                            {agent.social.email && (
                              <div className="text-sm">
                                <span className="font-medium">Contact:</span>{" "}
                                {agent.social.email}
                              </div>
                            )}
                            {agent.social.twitter && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="font-medium">Twitter:</span>
                                <a
                                  href={`https://twitter.com/${agent.social.twitter}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                >
                                  <Twitter size={14} />@{agent.social.twitter}
                                </a>
                              </div>
                            )}
                            {agent.social.github && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="font-medium">GitHub:</span>
                                <a
                                  href={`https://github.com/${agent.social.github}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                                >
                                  <Github size={14} />
                                  {agent.social.github}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {agent.skills && agent.skills.length > 0 && (
                        <div>
                          <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                            SKILLS
                          </h4>
                          <ul className="ml-4 list-disc">
                            {agent.skills.map((skill, skillIndex) => (
                              <li key={skillIndex} className="text-sm">
                                {skill.type}
                                {skill.type === "Other" &&
                                  skill.customSkill && (
                                    <>: {skill.customSkill}</>
                                  )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                        DESCRIPTION
                      </h4>
                      {agent.description ? (
                        <p className="whitespace-pre-line text-sm">
                          {agent.description}
                        </p>
                      ) : (
                        <p className="text-muted-foreground text-sm">
                          No description provided
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )),
        )}
      </div>
    </div>
  );
}
