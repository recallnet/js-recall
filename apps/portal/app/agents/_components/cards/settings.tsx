import { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";
import { Input } from "@recallnet/ui/components/shadcn/input";
import { Label } from "@recallnet/ui/components/shadcn/label";
import { Textarea } from "@recallnet/ui/components/shadcn/textarea";
import { cn } from "@recallnet/ui/lib/utils";

type ChatProps = ComponentProps<typeof Card> & {
  name: string;
  systemInstructions: string;
};

export function Settings({
  className,
  name,
  systemInstructions,
  ...props
}: ChatProps) {
  return (
    <Card className={cn("rounded-none", className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle>Agent Settings</CardTitle>
        <CardDescription>General agenent information.</CardDescription>
      </CardHeader>
      <CardContent>
        <Label>Name</Label>
        <Input placeholder="Agent Name" defaultValue={name} />
        <Label>System Instructions</Label>
        <Textarea
          placeholder="System Instructions"
          defaultValue={systemInstructions}
        />
      </CardContent>
    </Card>
  );
}
