import { Grid2X2, List, SortAsc, SortDesc } from "lucide-react";
import { useMemo, useState } from "react";
import { Address } from "viem";

import { Button } from "@recallnet/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@recallnet/ui/components/dropdown-menu";
import { cn } from "@recallnet/ui/lib/utils";

import ObjectListItem from "./object-list-item";
import PrefixListItem from "./prefix-list-item";

type ViewMode = "list" | "grid";
type SortField = "name" | "size" | "date";
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
}

export default function FileListView({
  bucketAddress,
  parentPath,
  delimiter,
  commonPrefixes,
  objects,
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const toggleSortDirection = () => {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  };

  const sortedObjects = useMemo(() => {
    const sorted = [...objects].sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.key.localeCompare(b.key);
        case "size":
          return Number(a.state.size - b.state.size);
        case "date": {
          const aDate = a.state.metadata.find((m) => m.key === "date")?.value || "";
          const bDate = b.state.metadata.find((m) => m.key === "date")?.value || "";
          return aDate.localeCompare(bDate);
        }
        default:
          return 0;
      }
    });

    return sortDirection === "desc" ? sorted.reverse() : sorted;
  }, [objects, sortField, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              Sort by {sortField}
              {sortDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortField("name")}>
              Name
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortField("size")}>
              Size
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortField("date")}>
              Date
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSortDirection}
          className="px-3"
        >
          {sortDirection === "asc" ? <SortAsc size={16} /> : <SortDesc size={16} />}
        </Button>
        <div className="flex border rounded-md overflow-hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("list")}
            className={cn(
              "rounded-none border-0 px-3",
              viewMode === "list" && "bg-accent"
            )}
          >
            <List size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setViewMode("grid")}
            className={cn(
              "rounded-none border-0 border-l px-3",
              viewMode === "grid" && "bg-accent"
            )}
          >
            <Grid2X2 size={16} />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid gap-4",
          viewMode === "grid" && "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
        )}
      >
        {commonPrefixes.map((commonPrefix) => (
          <PrefixListItem
            key={commonPrefix}
            bucketAddress={bucketAddress}
            parentPath={parentPath}
            commonPrefix={commonPrefix}
            delimiter={delimiter}
          />
        ))}
        {sortedObjects.map((object) => (
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