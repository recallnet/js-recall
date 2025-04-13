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

type ChatProps = ComponentProps<typeof Card> & {
  apiUrl: string;
  apiKey: string;
};

export function Auth({ apiUrl, apiKey, ...props }: ChatProps) {
  return (
    <Card {...props}>
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
