import { useState } from "react";

import { Input } from "@recallnet/ui/components/input";
import { Label } from "@recallnet/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@recallnet/ui/components/select";

interface SearchAndFilterProps {
  onSearchChange: (search: string) => void;
  onAgentChange: (agent: string) => void;
}

export function SearchAndFilter({
  onSearchChange,
  onAgentChange,
}: SearchAndFilterProps) {
  const [search, setSearch] = useState("");
  const [agent, setAgent] = useState("all");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    onSearchChange(e.target.value);
  };

  const handleAgentChange = (value: string) => {
    setAgent(value);
    onAgentChange(value);
  };

  return (
    <div className="mb-6 space-y-4">
      <div>
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          type="text"
          placeholder="Search by filename"
          value={search}
          onChange={handleSearchChange}
        />
      </div>
      <div>
        <Label htmlFor="agent">Filter by Agent</Label>
        <Select onValueChange={handleAgentChange} value={agent}>
          <SelectTrigger id="agent">
            <SelectValue placeholder="Select an agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Agents</SelectItem>
            {Array.from({ length: 10 }, (_, i) => (
              <SelectItem key={i} value={`Agent-${i + 1}`}>
                Agent-{i + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
