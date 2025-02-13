import { ComponentProps } from "react";

import { Button } from "@recallnet/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { ScrollArea } from "@recallnet/ui/components/scroll-area";
import { Textarea } from "@recallnet/ui/components/textarea";
import { cn } from "@recallnet/ui/lib/utils";

type ChatProps = ComponentProps<typeof Card>;

export function Chat({ className, ...props }: ChatProps) {
  return (
    <Card className={cn("rounded-none", className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle>Agent chat</CardTitle>
        <CardDescription>Interact with your agent.</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-96 border"></ScrollArea>
        <Textarea placeholder="Type your message here." />
        <Button>Send</Button>
      </CardContent>
    </Card>
  );
}
