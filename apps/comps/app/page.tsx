import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@recallnet/ui2/components/avatar";
import {Button} from "@recallnet/ui2/components/button";
import {Button as ShadcnButton} from "@recallnet/ui2/components/shadcn/button";

export default function Page() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Avatar>
        <AvatarImage src="https://github.com/recallnet.png" alt="recallnet" />
        <AvatarFallback>R</AvatarFallback>
      </Avatar>
      <Button variant="default">Default button</Button>
      <Button variant="destructive">Destructive button</Button>
      <ShadcnButton>Shadcn button</ShadcnButton>
    </div>
  );
}
