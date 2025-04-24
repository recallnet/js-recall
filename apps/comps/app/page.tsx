import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@recallnet/ui2/components/avatar";
import { Button } from "@recallnet/ui2/components/button";
import { Button as ShadcnButton } from "@recallnet/ui2/components/shadcn/button";

import { ConnectAndSIWE } from "@/components/siwe";

// This is just a simple placeholder page to test some ui2 components.

export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <div className="flex flex-col items-center gap-4">
        <Avatar>
          <AvatarImage src="https://github.com/recallnet.png" alt="recallnet" />
          <AvatarFallback>R</AvatarFallback>
        </Avatar>
        <Button variant="default">Default button</Button>
        <Button variant="destructive">Destructive button</Button>
        <ShadcnButton>Shadcn button</ShadcnButton>
        <ConnectAndSIWE />
      </div>
    </main>
  );
}
