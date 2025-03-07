"use client";

import { useCallback, useEffect, useState } from "react";

import { InfiniteScroll } from "@recallnet/ui/recall/infinite-scroll";

import type { AgentActivity } from "@/types/agent-activity";
import { fetchAgentActivity } from "@/utils/fetch-agent-activity";

import { AgentActivityList } from "./agent-activity-list";
import { SearchAndFilter } from "./search-and-filter";

const PAGE_SIZE = 10;

export default function AgentActivity() {
  const [allActivities, setAllActivities] = useState<AgentActivity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<AgentActivity[]>(
    [],
  );
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("all");

  const loadMoreData = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      console.log("Loading more data");
      const newData = await fetchAgentActivity(page, PAGE_SIZE);
      if (newData.length < PAGE_SIZE) {
        setHasMore(false);
      }
      setAllActivities((prev) => [...prev, ...newData]);
      setPage((prev) => prev + 1);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, isLoading]);

  useEffect(() => {
    const filtered = allActivities.filter((activity) => {
      const matchesSearch = activity.filename
        .toLowerCase()
        .includes(search.toLowerCase());
      const matchesAgent =
        selectedAgent === "all" || activity.agent === selectedAgent;
      return matchesSearch && matchesAgent;
    });
    setFilteredActivities(filtered);
  }, [allActivities, search, selectedAgent]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
  };

  const handleAgentChange = (newAgent: string) => {
    setSelectedAgent(newAgent);
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold">AI Agent Activity Dashboard</h1>
      <SearchAndFilter
        onSearchChange={handleSearchChange}
        onAgentChange={handleAgentChange}
      />
      <AgentActivityList activities={filteredActivities} />
      <InfiniteScroll onLoadMore={loadMoreData} hasMore={hasMore} />
    </main>
  );
}
