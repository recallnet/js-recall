import { ComponentProps } from "react";

import { Button } from "@recallnet/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";
import { ScrollArea } from "@recallnet/ui/components/shadcn/scroll-area";
import { Textarea } from "@recallnet/ui/components/shadcn/textarea";

type ChatProps = ComponentProps<typeof Card>;

export function Chat(props: ChatProps) {
  return (
    <Card {...props}>
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
