import { Search, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

import { Input } from "@recallnet/ui/components/input";
import { Button } from "@recallnet/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@recallnet/ui/components/select";

interface Props {
  onSearch: (query: string) => void;
  onFilterChange: (filter: string) => void;
}

export default function FileSearch({ onSearch, onFilterChange }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 300);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    onSearch(debouncedQuery);
  }, [debouncedQuery, onSearch]);

  const handleFilterChange = useCallback(
    (value: string) => {
      setFilter(value);
      onFilterChange(value);
    },
    [onFilterChange]
  );

  const handleClear = useCallback(() => {
    setSearchQuery("");
    setFilter("all");
    onSearch("");
    onFilterChange("all");
  }, [onSearch, onFilterChange]);

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9"
        />
        {searchQuery && (
          <X
            className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
            onClick={handleClear}
          />
        )}
      </div>
      <Select value={filter} onValueChange={handleFilterChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="Filter by type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Files</SelectItem>
          <SelectItem value="image">Images</SelectItem>
          <SelectItem value="video">Videos</SelectItem>
          <SelectItem value="audio">Audio</SelectItem>
          <SelectItem value="document">Documents</SelectItem>
          <SelectItem value="code">Code</SelectItem>
          <SelectItem value="archive">Archives</SelectItem>
          <SelectItem value="other">Other</SelectItem>
        </SelectContent>
      </Select>
      {(searchQuery || filter !== "all") && (
        <Button variant="ghost" size="icon" onClick={handleClear}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}