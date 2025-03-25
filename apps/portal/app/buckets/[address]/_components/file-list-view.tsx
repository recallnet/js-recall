import { Grid2X2, List, SortAsc, SortDesc } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Address } from "viem";

import { Button } from "@recallnet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuShortcut,
} from "@recallnet/ui/components/dropdown-menu";
import { cn } from "@recallnet/ui/lib/utils";
import { useToast } from "@recallnet/ui/hooks/use-toast";

import ObjectListItem from "./object-list-item";
import PrefixListItem from "./prefix-list-item";
import FileSearch from "./file-search";

type ViewMode = "list" | "grid";
type SortField = "name" | "size" | "date" | "lastModified";
type SortDirection = "asc" | "desc";

interface Props {
  bucketAddress: Address;
  parentPath: string;
  delimiter: string;
  commonPrefixes: string[];
  objects: {
    key: string;
    state: {
      blobHash: string;
      size: bigint;
      metadata: readonly {
        key: string;
        value: string;
      }[];
    };
  }[];
  className?: string;
}

export default function FileListView({
  bucketAddress,
  parentPath,
  delimiter,
  commonPrefixes,
  objects,
  className,
}: Props) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "grid" : "list");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "g":
            e.preventDefault();
            toggleViewMode();
            toast({
              title: "View Mode Changed",
              description: `Switched to ${viewMode === "list" ? "grid" : "list"} view`,
            });
            break;
          case "s":
            e.preventDefault();
            toggleSortDirection();
            toast({
              title: "Sort Direction Changed",
              description: `Sorting ${sortDirection === "asc" ? "descending" : "ascending"}`,
            });
            break;
          case "1":
            e.preventDefault();
            setSortField("name");
            toast({
              title: "Sort Field Changed",
              description: "Sorting by name",
            });
            break;
          case "2":
            e.preventDefault();
            setSortField("size");
            toast({
              title: "Sort Field Changed",
              description: "Sorting by size",
            });
            break;
          case "3":
            e.preventDefault();
            setSortField("date");
            toast({
              title: "Sort Field Changed",
              description: "Sorting by date",
            });
            break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, sortDirection]);

  const filteredObjects = useMemo(() => {
    let filtered = objects;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((obj) => obj.key.toLowerCase().includes(query));
    }

    // Apply type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((obj) => {
        const ext = obj.key.split(".").pop()?.toLowerCase();
        switch (typeFilter) {
          case "image":
            return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
          case "video":
            return ["mp4", "webm", "mov", "avi"].includes(ext || "");
          case "audio":
            return ["mp3", "wav", "ogg", "m4a"].includes(ext || "");
          case "document":
            return ["pdf", "doc", "docx", "txt", "md"].includes(ext || "");
          case "code":
            return ["js", "ts", "jsx", "tsx", "py", "go", "rs", "sol"].includes(ext || "");
          case "archive":
            return ["zip", "rar", "7z", "tar", "gz"].includes(ext || "");
          case "other":
            return !obj.state.metadata.find((m) => m.key === "type") || obj.state.metadata.find((m) => m.key === "type")?.value === "application/octet-stream";
          default:
            return true;
        }
      });
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "name":
          comparison = a.key.localeCompare(b.key);
          break;
        case "size":
          comparison = Number(a.state.size - b.state.size);
          break;
        case "date": {
          const aDate = a.state.metadata.find((m) => m.key === "date")?.value || "";
          const bDate = b.state.metadata.find((m) => m.key === "date")?.value || "";
          comparison = aDate.localeCompare(bDate);
          break;
        }
        case "lastModified": {
          const aDate = a.state.metadata.find((m) => m.key === "lastModified")?.value || "";
          const bDate = b.state.metadata.find((m) => m.key === "lastModified")?.value || "";
          comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
          break;
        }
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [objects, searchQuery, typeFilter, sortField, sortDirection]);

  const filteredPrefixes = useMemo(() => {
    if (!searchQuery) return commonPrefixes;
    const query = searchQuery.toLowerCase();
    return commonPrefixes.filter((prefix) => prefix.toLowerCase().includes(query));
  }, [commonPrefixes, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((filter: string) => {
    setTypeFilter(filter);
  }, []);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex items-center justify-between gap-4">
        <FileSearch onSearch={handleSearch} onFilterChange={handleFilterChange} />
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
            title={`Sort ${sortDirection === "asc" ? "descending" : "ascending"} (⌘S)`}
          >
            {sortDirection === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMode((prev) => (prev === "list" ? "grid" : "list"))}
            title={`Switch to ${viewMode === "list" ? "grid" : "list"} view (⌘G)`}
          >
            {viewMode === "list" ? (
              <Grid2X2 className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-2",
          viewMode === "grid" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-1"
        )}
      >
        {filteredPrefixes.map((prefix) => (
          <PrefixListItem
            key={prefix}
            bucketAddress={bucketAddress}
            parentPath={parentPath}
            commonPrefix={prefix}
            delimiter={delimiter}
            viewMode={viewMode}
          />
        ))}
        {filteredObjects.map((object) => (
          <ObjectListItem
            key={object.key}
            bucketAddress={bucketAddress}
            parentPath={parentPath}
            object={object}
            delimiter={delimiter}
            viewMode={viewMode}
          />
        ))}
      </div>
    </div>
  );
}