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

  // Filter teams
  const filteredTeams = teams
    ? teams.filter((team) => {
        const query = searchQuery.toLowerCase();
        if (query === "") return true;

        return (
          team.name.toLowerCase().includes(query) ||
          team.metadata?.description?.toLowerCase().includes(query) ||
          false ||
          team.metadata?.ref?.name?.toLowerCase().includes(query) ||
          false ||
          team.metadata?.social?.name?.toLowerCase().includes(query) ||
          false ||
          team.metadata?.social?.twitter?.toLowerCase().includes(query) ||
          false
        );
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
          Showing {filteredTeams.length} of {teams.length} registered entries
        </div>
      </div>

      <div className="space-y-4">
        {filteredTeams.map((team) => (
          <Card key={team.id} className="overflow-hidden">
            <div className="bg-muted/40 border-b px-6 py-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{team.name}</h3>
                <div className="text-muted-foreground text-sm">
                  Registered: {new Date(team.createdAt).toLocaleDateString()}
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

                    {team.metadata?.ref?.name ? (
                      <>
                        <h3 className="text-xl font-semibold">
                          {team.metadata.ref.name}
                          {team.metadata.ref.version && (
                            <span className="text-muted-foreground ml-2 text-sm font-normal">
                              v{team.metadata.ref.version}
                            </span>
                          )}
                        </h3>

                        {team.metadata.ref.url && (
                          <a
                            href={formatGitHubUrl(team.metadata.ref.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-primary mt-1 inline-flex items-center gap-1.5 text-sm"
                          >
                            {team.metadata.ref.url.includes("github") ? (
                              <Github size={14} />
                            ) : (
                              <ExternalLink size={14} />
                            )}
                            {team.metadata.ref.url.replace(/^https?:\/\//, "")}
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="text-muted-foreground">
                        No agent name specified
                      </div>
                    )}
                  </div>

                  {team.metadata?.social && (
                    <div>
                      <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                        SOCIAL
                      </h4>
                      <div className="space-y-1">
                        {team.metadata.social.name && (
                          <div className="text-sm">
                            <span className="font-medium">Display Name:</span>{" "}
                            {team.metadata.social.name}
                          </div>
                        )}
                        {team.metadata.social.email && (
                          <div className="text-sm">
                            <span className="font-medium">Contact:</span>{" "}
                            {team.metadata.social.email}
                          </div>
                        )}
                        {team.metadata.social.twitter && (
                          <div className="flex items-center gap-1 text-sm">
                            <span className="font-medium">Twitter:</span>
                            <a
                              href={`https://twitter.com/${team.metadata.social.twitter}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                            >
                              <Twitter size={14} />@
                              {team.metadata.social.twitter}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <h4 className="text-muted-foreground mb-2 text-sm font-semibold">
                    DESCRIPTION
                  </h4>
                  {team.metadata?.description ? (
                    <p className="whitespace-pre-line text-sm">
                      {team.metadata.description}
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
        ))}
      </div>
    </div>
  );
}
