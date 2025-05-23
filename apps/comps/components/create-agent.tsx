"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import { Input } from "@recallnet/ui2/components/shadcn/input";

// Skills list from AgentSkillType enum
const AGENT_SKILLS = [
  "Crypto Trading",
  "Traditional Investing",
  "Sports Betting",
  "Prediction Markets",
  "Social and Chat",
  "Art & Video Creation",
  "Programming / Coding",
  "Deep Research",
  "Other",
];

const formSchema = z
  .object({
    name: z.string().min(1, "Agent name is required"),
    walletAddress: z.string().min(1, "Wallet address is required"),
    imageUrl: z
      .string()
      .url({ message: "Must be a valid URL" })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    repositoryUrl: z.string().url({ message: "Must be a valid URL" }),
    skills: z.array(z.string()).min(1, "Select at least one skill"),
    otherSkill: z.string().optional(),
    description: z.string().optional(),
    email: z
      .string()
      .email({ message: "Invalid email address" })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    x: z
      .string()
      .url({ message: "Must be a valid URL" })
      .optional()
      .or(z.literal("").transform(() => undefined)),
    telegram: z
      .string()
      .url({ message: "Must be a valid URL" })
      .optional()
      .or(z.literal("").transform(() => undefined)),
  })
  .refine(
    (data) => {
      // If "Other" is selected, otherSkill must be provided
      if (data.skills.includes("Other")) {
        return data.otherSkill && data.otherSkill.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please specify your custom skill",
      path: ["otherSkill"], // This will show the error on the otherSkill field
    },
  );

export type FormData = z.infer<typeof formSchema>;

interface CreateAgentProps {
  onSubmit: (data: FormData) => Promise<void>;
  isSubmitting?: boolean;
}

export function CreateAgent({ onSubmit, isSubmitting }: CreateAgentProps) {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      walletAddress: "",
      imageUrl: "",
      repositoryUrl: "",
      skills: [],
      otherSkill: "",
      description: "",
      email: "",
      x: "",
      telegram: "",
    },
  });

  const handleSubmit = async (data: FormData) => {
    try {
      // If "Other" is selected and has a value, add it to the skills array
      const finalSkills =
        data.skills.includes("Other") && data.otherSkill
          ? [
              ...data.skills.filter((skill) => skill !== "Other"),
              data.otherSkill,
            ]
          : data.skills;

      await onSubmit({
        ...data,
        skills: finalSkills,
      });
    } catch {
      // Error handled by parent component
    }
  };

  return (
    <div className="flex h-full w-full flex-col pt-5">
      <h2 className="text-primary mb-4 w-full text-start text-2xl font-semibold">
        Register an Agent
      </h2>
      <p className="text-secondary-foreground mb-8">
        Make your AI discoverable on the Recall network.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Agent Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: Acme Chatbot" {...field} />
                </FormControl>
                {!errors.name && (
                  <FormDescription>
                    The name of your agent, or how they&apos;d like to be known.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="walletAddress"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Agent Wallet Address</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: 0xA1B2...F9E0" {...field} />
                </FormControl>
                {!errors.walletAddress && (
                  <FormDescription>
                    The wallet address that belongs to your agent.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Avatar (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="Enter the avatar URL..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="repositoryUrl"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Repository URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g.: https://repository.com"
                    {...field}
                  />
                </FormControl>
                {!errors.repositoryUrl && (
                  <FormDescription>Link to code or docs.</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="skills"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agent Skills</FormLabel>
                <div className="grid grid-cols-2 gap-2">
                  {AGENT_SKILLS.map((skill) => (
                    <label key={skill} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        value={skill}
                        checked={field.value.includes(skill)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            field.onChange([...field.value, skill]);
                          } else {
                            field.onChange(
                              field.value.filter((s: string) => s !== skill),
                            );
                          }
                        }}
                      />
                      <span className="text-secondary-foreground text-sm">
                        {skill}
                      </span>
                    </label>
                  ))}
                </div>
                {field.value.includes("Other") && (
                  <FormField
                    control={form.control}
                    name="otherSkill"
                    render={({ field: otherField }) => (
                      <FormItem className="mt-2">
                        <FormControl>
                          <Input
                            placeholder="Please specify your skill..."
                            {...otherField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormDescription>Choose all that apply.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Short Description (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Type your description here..."
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: agentemail@gmail.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="x"
            render={({ field }) => (
              <FormItem>
                <FormLabel>X (Twitter) (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: https://x.com/agent" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="telegram"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telegram (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g.: https://telegram.com/agent"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="rounded bg-blue-700 px-8 py-3 text-white hover:bg-blue-800 disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? "REGISTERING..." : "NEXT"}
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
}
