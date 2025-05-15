"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, Copy, Plus, Trash } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";

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

import { useAuthContext } from "@/components/auth-provider";
import { AgentSkillType, registerTeam } from "@/lib/api";
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
  const [showAgentForm, setShowAgentForm] = useState(true);
  const { wallet } = useAuthContext();

  const form = useForm<TeamRegistrationRequest>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      teamName: "",
      email: "",
      contactPerson: "",
      walletAddress: "",
      metadata: [
        {
          name: "",
          version: "",
          url: "",
          description: "",
          social: {
            email: "",
            twitter: "",
            github: "",
            discord: "",
            telegram: "",
          },
          skills: [],
        },
      ],
    },
  });

  // Set up field array for agents
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "metadata",
  });

  // Auto-fill the wallet address field with the connected wallet address
  useEffect(() => {
    if (wallet) {
      console.log("Connected wallet:", wallet);
      form.setValue("walletAddress", wallet);
    }
  }, [wallet, form]);

  /**
   * Adds a new agent to the form
   */
  const addNewAgent = () => {
    append({
      name: "",
      version: "",
      url: "",
      description: "",
      social: {
        email: "",
        twitter: "",
        github: "",
        discord: "",
        telegram: "",
      },
      skills: [],
    });
  };

  /**
   * Handle form submission for team registration
   *
   * @param data - Form data for team registration
   */
  async function onSubmit(data: TeamRegistrationRequest) {
    setIsSubmitting(true);
    try {
      // Clean up empty strings in agents array
      const cleanedData = { ...data };

      // Remove empty strings from agents
      if (cleanedData.metadata && cleanedData.metadata.length > 0) {
        cleanedData.metadata = cleanedData.metadata.map((agent) => {
          const cleanedAgent = { ...agent };

          // Remove empty strings from agent fields
          if (cleanedAgent.name === "") delete cleanedAgent.name;
          if (cleanedAgent.version === "") delete cleanedAgent.version;
          if (cleanedAgent.url === "") delete cleanedAgent.url;
          if (cleanedAgent.description === "") delete cleanedAgent.description;

          // Handle social properties
          if (cleanedAgent.social) {
            const social = { ...cleanedAgent.social };

            if (social.email === "") delete social.email;
            if (social.twitter === "") delete social.twitter;
            if (social.github === "") delete social.github;
            if (social.discord === "") delete social.discord;
            if (social.telegram === "") delete social.telegram;

            if (Object.keys(social).length === 0) {
              delete cleanedAgent.social;
            } else {
              cleanedAgent.social = social;
            }
          }

          // Filter out any skills that have empty custom skills
          if (cleanedAgent.skills && cleanedAgent.skills.length > 0) {
            cleanedAgent.skills = cleanedAgent.skills.filter(
              (skill) =>
                skill.type !== AgentSkillType.Other ||
                (skill.customSkill && skill.customSkill.trim() !== ""),
            );

            if (cleanedAgent.skills.length === 0) {
              delete cleanedAgent.skills;
            }
          }

          return cleanedAgent;
        });

        // Filter out completely empty agents
        cleanedData.metadata = cleanedData.metadata.filter(
          (agent) => Object.keys(agent).length > 0,
        );

        if (cleanedData.metadata.length === 0) {
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
                <FormLabel>Wallet Address</FormLabel>
                <FormControl>
                  <Input readOnly {...field} />
                </FormControl>
                <FormDescription>
                  Automatically filled with your connected and authenticated
                  wallet address. You must be signed in with your wallet to
                  register.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Agents section */}
        <div className="bg-card/50 rounded-lg border p-5">
          <div
            className="flex cursor-pointer items-center justify-between"
            onClick={() => setShowAgentForm(!showAgentForm)}
          >
            <h3 className="text-lg font-medium">
              Agent Information (optional)
            </h3>
            <div className="text-lg">{showAgentForm ? "▲" : "▼"}</div>
          </div>

          {showAgentForm && (
            <div className="mt-4 space-y-6 border-t pt-6">
              {fields.map((field, index) => (
                <div key={field.id} className="space-y-4 border-b pb-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-md font-semibold">Agent {index + 1}</h4>
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-destructive h-8"
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Remove Agent
                      </Button>
                    )}
                  </div>

                  <FormField
                    control={form.control}
                    name={`metadata.${index}.name`}
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

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name={`metadata.${index}.version`}
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
                      name={`metadata.${index}.url`}
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

                  <FormField
                    control={form.control}
                    name={`metadata.${index}.description`}
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

                  <div className="space-y-2">
                    <h5 className="text-sm font-medium">Skills</h5>
                    {Object.values(AgentSkillType).map(
                      (skillType, skillIndex) => (
                        <div
                          key={skillIndex}
                          className="flex items-center space-x-2"
                        >
                          <input
                            type="checkbox"
                            id={`skill-${index}-${skillIndex}`}
                            checked={
                              form
                                .getValues(`metadata.${index}.skills`)
                                ?.some((s) => s.type === skillType) || false
                            }
                            onChange={(e) => {
                              const currentSkills =
                                form.getValues(`metadata.${index}.skills`) ||
                                [];
                              if (e.target.checked) {
                                // Add skill
                                form.setValue(`metadata.${index}.skills`, [
                                  ...currentSkills,
                                  {
                                    type: skillType,
                                    customSkill:
                                      skillType === AgentSkillType.Other
                                        ? ""
                                        : undefined,
                                  },
                                ]);
                              } else {
                                // Remove skill
                                form.setValue(
                                  `metadata.${index}.skills`,
                                  currentSkills.filter(
                                    (s) => s.type !== skillType,
                                  ),
                                );
                              }
                            }}
                            className="h-4 w-4"
                          />
                          <label
                            htmlFor={`skill-${index}-${skillIndex}`}
                            className="text-sm"
                          >
                            {skillType}
                          </label>

                          {skillType === AgentSkillType.Other &&
                            form
                              .getValues(`metadata.${index}.skills`)
                              ?.some(
                                (s) => s.type === AgentSkillType.Other,
                              ) && (
                              <Input
                                placeholder="Specify your custom skill"
                                value={
                                  form
                                    .getValues(`metadata.${index}.skills`)
                                    ?.find(
                                      (s) => s.type === AgentSkillType.Other,
                                    )?.customSkill || ""
                                }
                                onChange={(e) => {
                                  const currentSkills =
                                    form.getValues(
                                      `metadata.${index}.skills`,
                                    ) || [];
                                  const otherSkillIndex =
                                    currentSkills.findIndex(
                                      (s) => s.type === AgentSkillType.Other,
                                    );
                                  if (otherSkillIndex >= 0) {
                                    const updatedSkills = [...currentSkills];
                                    updatedSkills[otherSkillIndex] = {
                                      ...updatedSkills[otherSkillIndex],
                                      customSkill: e.target.value,
                                    };
                                    form.setValue(
                                      `metadata.${index}.skills`,
                                      updatedSkills,
                                    );
                                  }
                                }}
                                className="ml-2 h-8 w-52"
                              />
                            )}
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-6">
                    <h5 className="mb-2 text-sm font-medium">Social</h5>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`metadata.${index}.social.email`}
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
                          name={`metadata.${index}.social.twitter`}
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

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <FormField
                          control={form.control}
                          name={`metadata.${index}.social.github`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>GitHub</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="GitHub username"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name={`metadata.${index}.social.discord`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Discord</FormLabel>
                              <FormControl>
                                <Input
                                  placeholder="Discord username or server"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`metadata.${index}.social.telegram`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telegram</FormLabel>
                            <FormControl>
                              <Input placeholder="Telegram handle" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex justify-center pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addNewAgent}
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Another Agent
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center pt-4">
          {!wallet && (
            <div className="mb-4 text-center text-orange-500">
              Please connect and authenticate your wallet to register
            </div>
          )}
          <Button
            type="submit"
            disabled={isSubmitting || !wallet}
            className="px-8"
          >
            {isSubmitting ? "Registering..." : "Register Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
