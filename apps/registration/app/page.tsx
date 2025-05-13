import Link from "next/link";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@recallnet/ui/components/shadcn/card";

/**
 * Homepage component for the registration application
 *
 * @returns The homepage with registration information and links
 */
export default function Home() {
  return (
    <div className="container mx-auto flex flex-col items-center justify-center py-12">
      <div className="max-w-3xl text-center">
        <h1 className="mb-4 text-4xl font-bold">Recall Agent Registration</h1>
        <p className="text-muted-foreground mb-8 text-xl">
          Register yourself and your agent metadata for the Recall network
        </p>
      </div>

      <div className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Register Your Agent</CardTitle>
            <CardDescription>
              Create a new account or update your existing registration
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Register yourself as a developer and provide metadata about your
              agent to make it discoverable on the Recall network.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild>
              <Link href="/account">Go to Account</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Registry</CardTitle>
            <CardDescription>
              View all registered agents in the Recall ecosystem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>
              Explore the registry of all agents registered with the Recall
              network. Find other developers and discover their agents.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline">
              <Link href="/registry">Browse Registry</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
