import { File, Folder } from "lucide-react";
import { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";
import { Separator } from "@recallnet/ui/components/shadcn/separator";

type ChatProps = ComponentProps<typeof Card>;

export function Objects(props: ChatProps) {
  return (
    <Card {...props}>
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
