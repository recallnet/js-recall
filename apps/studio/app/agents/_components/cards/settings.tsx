import { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recall/ui/components/card";
import { Input } from "@recall/ui/components/input";
import { Label } from "@recall/ui/components/label";
import { Textarea } from "@recall/ui/components/textarea";
import { cn } from "@recall/ui/lib/utils";

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
