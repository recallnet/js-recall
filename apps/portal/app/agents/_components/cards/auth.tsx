import { ComponentProps } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/card";
import { Input } from "@recallnet/ui/components/input";
import { Label } from "@recallnet/ui/components/label";
import { cn } from "@recallnet/ui/lib/utils";

type ChatProps = ComponentProps<typeof Card> & {
  apiUrl: string;
  apiKey: string;
};

export function Auth({ className, apiUrl, apiKey, ...props }: ChatProps) {
  return (
    <Card className={cn("rounded-none", className)} {...props}>
      <CardHeader className="pb-3">
        <CardTitle>Agent Authentication</CardTitle>
        <CardDescription>
          Connection settings for interacting with the agent endpoint.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Label>Endpoint URL</Label>
        <Input placeholder="Endpoint URL" defaultValue={apiUrl} />
        <Label>API Key</Label>
        <Input placeholder="API Key" defaultValue={apiKey} />
      </CardContent>
    </Card>
  );
}
