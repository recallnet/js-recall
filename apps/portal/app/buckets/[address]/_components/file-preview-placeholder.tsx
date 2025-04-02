/**
 * A temporary placeholder component that will be replaced with the actual file preview
 * implementation in Phase 2.
 */
import { FileIcon } from "lucide-react";

export function FilePreviewPlaceholder() {
  return (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center border p-8">
      <FileIcon className="mb-4 h-12 w-12" />
      <p>File Preview Coming Soon</p>
      <p className="text-xs">
        Preview functionality will be added in the next phase
      </p>
    </div>
  );
}
