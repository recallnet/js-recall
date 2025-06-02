
import {ArrowDownUp} from "lucide-react";

import {cn} from "@recallnet/ui2/lib/utils";
import {
  TableHead,
} from "@recallnet/ui2/components/table";

export function SortableHeader({
  title,
  className,
}: {
  title: string;
  className?: string;
}) {
  return (
    <TableHead className={cn("text-left", className)}>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-white">{title}</span>
        <ArrowDownUp className="text-gray-600" size={20} />
      </div>
    </TableHead>
  );
}

export default SortableHeader
