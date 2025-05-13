"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useAccount } from "wagmi";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui/components/shadcn/form";
import { Input } from "@recallnet/ui/components/shadcn/input";
import { Textarea } from "@recallnet/ui/components/shadcn/textarea";

import { registerTeam } from "@/lib/api";
import type { Team, TeamRegistrationRequest } from "@/lib/api";
import { registrationSchema } from "@/lib/validation";

type RegistrationFormProps = {
  /**
   * Optional callback for when registration is successful
   */
  onSuccess?: (team: Team) => void;
};

/**
 * Registration form component for teams to register with the Recall network
 *
 * @param props - Component props
 * @returns Registration form component
 */
export function RegistrationForm({ onSuccess }: RegistrationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);
  const [registeredTeam, setRegisteredTeam] = useState<Team | null>(null);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [showMetadata, setShowMetadata] = useState(true);
  const { address, isConnected } = useAccount();

  const form = useForm<TeamRegistrationRequest>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      teamName: "",
      email: "",
      contactPerson: "",
      walletAddress: "",
      metadata: {
        ref: {
          name: "",
          version: "",
          url: "",
        },
        description: "",
        social: {
          name: "",
          email: "",
          twitter: "",
        },
      },
    },
  });

  // Auto-fill the wallet address field with the connected wallet address
  useEffect(() => {
    if (isConnected && address) {
      form.setValue("walletAddress", address);
    }
  }, [isConnected, address, form]);

  /**
   * Handle form submission for team registration
   *
   * @param data - Form data for team registration
   */
  async function onSubmit(data: TeamRegistrationRequest) {
    setIsSubmitting(true);
    try {
      // Clean up empty strings in metadata
      const cleanedData = { ...data };

      // Remove empty strings from metadata
      if (cleanedData.metadata) {
        // Handle ref properties
        if (cleanedData.metadata.ref) {
          // Clean ref fields
          const ref = cleanedData.metadata.ref;
          if (ref.name === "") delete ref.name;
          if (ref.version === "") delete ref.version;
          if (ref.url === "") delete ref.url;

          if (Object.keys(ref).length === 0) {
            delete cleanedData.metadata.ref;
          }
        }

        // Handle social properties
        if (cleanedData.metadata.social) {
          // Clean social fields
          const social = cleanedData.metadata.social;
          if (social.name === "") delete social.name;
          if (social.email === "") delete social.email;
          if (social.twitter === "") delete social.twitter;

          if (Object.keys(social).length === 0) {
            delete cleanedData.metadata.social;
          }
        }

        if (!cleanedData.metadata.description) {
          delete cleanedData.metadata.description;
        }

        if (Object.keys(cleanedData.metadata).length === 0) {
          delete cleanedData.metadata;
        }
      }

      // Submit the registration
      const team = await registerTeam(cleanedData);

      setRegisteredTeam(team);
      setRegistrationSuccess(true);
      if (onSuccess) {
        onSuccess(team);
      }
      // Show success message
      console.log("Registration successful!");
    } catch (error) {
      let message = "Failed to register team";
      if (error instanceof Error) {
        message = error.message;
      }
      console.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  /**
   * Copy API key to clipboard
   */
  const copyApiKey = () => {
    if (registeredTeam?.apiKey) {
      navigator.clipboard.writeText(registeredTeam.apiKey);
      setApiKeyCopied(true);
      console.log("API Key copied to clipboard");
      setTimeout(() => setApiKeyCopied(false), 2000);
    }
  };

  if (registrationSuccess && registeredTeam) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="mb-4 text-center text-2xl font-bold">
            Registration Successful!
          </h2>
          <p className="text-muted-foreground mb-6 text-center">
            Your team has been registered. Please save your API key securely.
          </p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Team Details</h3>
            <div className="space-y-1 pl-1">
              <p>
                <strong>Team Name:</strong> {registeredTeam.name}
              </p>
              <p>
                <strong>Email:</strong> {registeredTeam.email}
              </p>
              <p>
                <strong>Contact Person:</strong> {registeredTeam.contactPerson}
              </p>
              {registeredTeam.walletAddress && (
                <p>
                  <strong>Wallet Address:</strong>{" "}
                  {registeredTeam.walletAddress}
                </p>
              )}
            </div>
          </div>

          <div className="bg-muted/50 mt-6 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">API Key</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={copyApiKey}
                className="h-8 gap-1"
              >
                {apiKeyCopied ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {apiKeyCopied ? "Copied" : "Copy"}
              </Button>
            </div>
            <div className="bg-background break-all rounded-md p-3 font-mono text-sm">
              {registeredTeam.apiKey}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-center">
          <Button
            onClick={() => {
              setRegistrationSuccess(false);
              setRegisteredTeam(null);
              form.reset();
            }}
          >
            Register Another Team
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="teamName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Team Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your team name" {...field} />
                </FormControl>
                <FormDescription>
                  The name of your team or organization
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Contact email for your team</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="contactPerson"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact Person</FormLabel>
                <FormControl>
                  <Input placeholder="Enter contact person name" {...field} />
                </FormControl>
                <FormDescription>
                  Name of the primary contact person
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="walletAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Wallet Address (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="0x..." {...field} />
                </FormControl>
                <FormDescription>
                  Ethereum wallet address (must start with 0x, and should be the
                  address of the wallet you use to sign in)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Metadata section with simple toggle instead of accordion */}
        <div className="bg-card/50 rounded-lg border p-5">
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setShowMetadata(!showMetadata)}
          >
            <h3 className="text-lg font-medium">Agent Metadata (optional)</h3>
            <div className="text-lg">{showMetadata ? "▲" : "▼"}</div>
          </div>

          {showMetadata && (
            <div className="mt-4 space-y-4 border-t pt-6">
              <div>
                <h3 className="text-md mb-3 font-semibold">Reference</h3>
                <div className="space-y-4 pl-1">
                  <FormField
                    control={form.control}
                    name="metadata.ref.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Agent Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter agent name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.ref.version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Version</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., 1.0.0" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.ref.url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://github.com/yourusername/youragent"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="metadata.description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe your agent and its capabilities"
                        className="min-h-24"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-6">
                <h3 className="text-md mb-3 font-semibold">Social</h3>
                <div className="space-y-4 pl-1">
                  <FormField
                    control={form.control}
                    name="metadata.social.name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Social display name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.social.email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Public Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="Public contact email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="metadata.social.twitter"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Twitter</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Twitter handle (without @)"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-center pt-4">
          <Button type="submit" disabled={isSubmitting} className="px-8">
            {isSubmitting ? "Registering..." : "Register Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
