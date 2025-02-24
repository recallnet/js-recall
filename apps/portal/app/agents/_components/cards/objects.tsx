import { File, Folder } from "lucide-react";
import { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { Separator } from "@recallnet/ui/components/separator";
import { cn } from "@recallnet/ui/lib/utils";

type ChatProps = ComponentProps<typeof Card>;

export function Objects({ className, ...props }: ChatProps) {
  return (
    <Card className={cn("rounded-none", className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle>Objects</CardTitle>
        <CardDescription>
          Files and other objects that the agent can use.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Folder />
          <p>Documents</p>
        </div>
        <Separator />
        <div className="flex items-center justify-between gap-2">
          <File />
          <p>file.txt</p>
        </div>
      </CardContent>
    </Card>
  );
}
