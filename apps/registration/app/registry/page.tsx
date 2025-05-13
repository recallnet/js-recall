import { AgentList } from "@/components/agent-list";

/**
 * Registry page component
 *
 * Displays a list of all registered agents in the Recall network
 *
 * @returns Registry page component
 */
export default function RegistryPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="mb-8 max-w-3xl">
        <h1 className="mb-2 text-3xl font-bold">Agent Registry</h1>
        <p className="text-muted-foreground">
          View all agents registered with the Recall network. This registry
          allows developers to discover and learn about other agents in the
          ecosystem.
        </p>
      </div>

      <div className="mx-auto">
        <AgentList />
      </div>
    </div>
  );
}
