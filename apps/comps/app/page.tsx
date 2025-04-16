import { Button } from "@recallnet/ui2/components/button";

export default function Page() {
  return (
    <main className="container mx-auto p-4">
      <div className="flex flex-col items-center gap-4">
        <Button variant="default">Default button</Button>
        <Button variant="destructive">Destructive button</Button>
      </div>
    </main>
  );
}
