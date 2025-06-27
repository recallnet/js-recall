"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useAccount } from "wagmi";
import { z } from "zod";

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

import { useCreateAgent } from "@/hooks/useCreateAgent";
import { useUpdateProfile } from "@/hooks/useProfile";
import { asOptionalStringWithoutEmpty } from "@/utils";

import { ProfileFormData } from "./developer-profile-form";

// Agent skills constants
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

// Form schema - same pattern as /create-agent
const formSchema = z
  .object({
    name: z.string().min(1, "Agent name is required"),
    imageUrl: asOptionalStringWithoutEmpty(
      z.string().url({ message: "Must be a valid URL" }),
    ),
    repositoryUrl: asOptionalStringWithoutEmpty(
      z.string().url({ message: "Must be a valid URL" }),
    ),
    skills: z.array(z.string()).min(1, "Select at least one skill"),
    otherSkill: z.string().optional(),
    description: asOptionalStringWithoutEmpty(z.string()),
    x: asOptionalStringWithoutEmpty(z.string()),
    telegram: asOptionalStringWithoutEmpty(z.string()),
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
      path: ["otherSkill"],
    },
  );

export type FormData = z.infer<typeof formSchema>;

export interface AgentFormData {
  name: string;
  selectedSkills: string[];
  customSkill: string;
  repoUrl: string;
  description: string;
  avatar: string;
  twitter: string;
  telegram: string;
  apiKey?: string;
}

interface AgentRegistrationFormProps {
  initialData?: AgentFormData;
  profileData: ProfileFormData;
  onBack?: () => void;
  onNext?: (data: AgentFormData) => void;
}

/**
 * AgentRegistrationForm component using React Hook Form + Zod validation
 *
 * Standardized to match the /create-agent page approach
 */
export default function AgentRegistrationForm({
  initialData,
  profileData,
  onBack,
  onNext,
}: AgentRegistrationFormProps) {
  const { address } = useAccount();
  const updateProfileMutation = useUpdateProfile();
  const createAgentMutation = useCreateAgent();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      imageUrl: initialData?.avatar || "",
      repositoryUrl: initialData?.repoUrl || "",
      skills: initialData?.selectedSkills || [],
      otherSkill: initialData?.customSkill || "",
      description: initialData?.description || "",
      x: initialData?.twitter || "",
      telegram: initialData?.telegram || "",
    },
    mode: "onChange",
  });

  const {
    formState: { isSubmitting },
    setError,
    watch,
  } = form;

  const selectedSkills = watch("skills");
  const showCustomSkill = selectedSkills.includes("Other");

  const handleSubmit = async (data: FormData) => {
    console.log("=== FORM SUBMISSION STARTED ===");
    console.log("Form data received:", data);
    console.log("Address:", address);

    try {
      // Validation
      if (!address) {
        console.log("❌ No wallet address - stopping submission");
        setError("root", { message: "Wallet connection required." });
        return;
      }

      // First, update the profile (NO agent description here!)
      const profileUpdateData = {
        name: profileData.name,
        email: profileData.email,
        ...(profileData.website && {
          metadata: { website: profileData.website },
        }),
      };

      await updateProfileMutation.mutateAsync(profileUpdateData);

      // Prepare skills array (replace "Other" with custom skill if provided)
      const finalSkills =
        data.skills.includes("Other") && data.otherSkill
          ? [
              ...data.skills.filter((skill) => skill !== "Other"),
              data.otherSkill,
            ]
          : data.skills;

      // Create the agent - exact same structure as /create-agent page
      const agentData = {
        name: data.name,
        imageUrl: data.imageUrl,
        email: undefined, // Registration form doesn't collect agent email
        description: data.description,
        metadata: {
          skills: finalSkills,
          repositoryUrl: data.repositoryUrl,
          x: data.x,
          telegram: data.telegram,
        },
      };

      const response = await createAgentMutation.mutateAsync(agentData);

      // Convert back to AgentFormData format for compatibility
      const updatedFormData: AgentFormData = {
        name: data.name,
        selectedSkills: finalSkills,
        customSkill: data.otherSkill || "",
        repoUrl: data.repositoryUrl || "",
        description: data.description || "",
        avatar: data.imageUrl || "",
        twitter: data.x || "",
        telegram: data.telegram || "",
        apiKey: response.agent.apiKey,
      };

      // Call onNext to proceed to the success step
      if (onNext) {
        onNext(updatedFormData);
      }
    } catch (err) {
      console.error("Registration failed:", err);
      setError("root", {
        message:
          err instanceof Error
            ? err.message
            : "Failed to register. Please try again.",
      });
    }
  };

  return (
    <div className="w-full rounded-lg border border-[#303846] bg-[#11121A] p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[31.2px] text-white">
          Agent Information
        </h2>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-[#6D85A4] hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {form.formState.errors.root && (
            <div className="rounded border border-red-600 bg-red-600/10 p-3 text-red-400">
              {form.formState.errors.root.message}
            </div>
          )}

          {/* Agent Name - Required */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Agent Name *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter your agent's name"
                    className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Agent Skills */}
          <FormField
            control={form.control}
            name="skills"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Agent Skills</FormLabel>
                <FormDescription className="text-[#6D85A4]">
                  Choose all that apply.
                </FormDescription>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {AGENT_SKILLS.map((skill) => (
                    <label key={skill} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        value={skill}
                        className="h-4 w-4 rounded border-[#303846] bg-[#1A1D26] text-[#4F7396] focus:ring-[#4F7396]"
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
                      <span className="text-sm text-[#6D85A4]">{skill}</span>
                    </label>
                  ))}
                </div>
                {showCustomSkill && (
                  <FormField
                    control={form.control}
                    name="otherSkill"
                    render={({ field: otherField }) => (
                      <FormItem className="mt-3">
                        <FormControl>
                          <Input
                            placeholder="Please specify your custom skill..."
                            className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                            {...otherField}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Repository URL */}
          <FormField
            control={form.control}
            name="repositoryUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">Repository URL</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://github.com/your-repo"
                    className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                    {...field}
                  />
                </FormControl>
                <FormDescription className="text-[#6D85A4]">
                  Link to code or docs.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Description */}
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  Description (Optional)
                </FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Describe your agent..."
                    rows={3}
                    className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Avatar URL */}
          <FormField
            control={form.control}
            name="imageUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-white">
                  Avatar URL (Optional)
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://example.com/avatar.png"
                    className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Social Links */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="x"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">
                    Twitter (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@username or URL"
                      className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                      {...field}
                    />
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
                  <FormLabel className="text-white">
                    Telegram (Optional)
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="@username or URL"
                      className="border-[#303846] bg-[#1A1D26] text-white placeholder-[#6D85A4] focus:border-[#4F7396]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-[#4F7396] py-3 font-medium text-white hover:bg-[#6D85A4] disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating Agent...
              </div>
            ) : (
              "Create Agent"
            )}
          </button>
        </form>
      </Form>
    </div>
  );
}
