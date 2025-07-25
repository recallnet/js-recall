import { Search } from "lucide-react";
import Image from "next/image";

import { Input } from "@recallnet/ui2/components/input";
import { cn } from "@recallnet/ui2/lib/utils";

export const Legend = ({
  dataKeys,
  colors,
  searchQuery,
  onSearchChange,
  agentImages,
  className,
}: {
  dataKeys: string[];
  colors: string[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  agentImages: Record<string, string>;
  className?: string;
}) => {
  const filteredKeys = dataKeys.filter((key) =>
    key.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className={cn("mb-6 p-5", className)}>
      <div className="max-w-150 relative mb-4 w-full">
        <Input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-full"
        />
        <Search
          className="absolute right-3 top-1/2 -translate-y-1/2 transform text-gray-400"
          size={16}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {filteredKeys.map((key) => (
          <div key={key} className="flex items-center gap-2 p-2">
            <div
              className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full border-2"
              style={{
                borderColor: colors[dataKeys.indexOf(key) % colors.length],
              }}
            >
              <Image
                src={
                  agentImages[key] ||
                  `https://api.dicebear.com/7.x/bottts/svg?seed=${key}`
                }
                alt={key}
                className="h-full w-full object-cover"
                fill
              />
            </div>
            <span className="truncate text-sm text-white">{key}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
