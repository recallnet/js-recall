"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigationGuard } from "next-navigation-guard";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Form } from "@recallnet/ui2/components/form";
import { toast } from "@recallnet/ui2/components/toast";

import { useRedirectTo } from "@/hooks/useRedirectTo";
import { Agent } from "@/types/agent";
import { asOptionalStringWithoutEmpty } from "@/utils";

import { UnsavedChangesModal } from "../modals/unsaved-changes-modal";
import { AgentCard } from "../user-agents";
import { AgentCreated } from "./agent-created";
import { BasicsStep } from "./basics-step";
import { HttpErrorMapping, mapHttpError } from "./http-error-mapping";
import { SocialsStep } from "./socials-step";
import { Steps } from "./steps";

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
    email: asOptionalStringWithoutEmpty(
      z.string().email({ message: "Invalid email address" }),
    ),
    x: asOptionalStringWithoutEmpty(
      z.string().url({ message: "Must be a valid URL" }),
    ),
    telegram: asOptionalStringWithoutEmpty(
      z.string().url({ message: "Must be a valid URL" }),
    ),
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
  agent?: Agent | null;
  apiKey?: string | null;
}

export function CreateAgent({
  onSubmit,
  isSubmitting,
  agent,
  apiKey,
}: CreateAgentProps) {
  const { redirectToUrl } = useRedirectTo("/profile");
  const [currentStep, setCurrentStep] = useState(1);
  const [httpErrorMapping, setHttpErrorMapping] =
    useState<HttpErrorMapping | null>(null);
  const router = useRouter();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      imageUrl: "",
      repositoryUrl: "",
      skills: [],
      otherSkill: "",
      description: "",
      email: "",
      x: "",
      telegram: "",
    },
    mode: "onChange",
  });

  const {
    formState: { isDirty },
    setError,
    setFocus,
  } = form;
  const navGuard = useNavigationGuard({ enabled: isDirty });

  useEffect(() => {
    if (agent && apiKey) {
      setCurrentStep(3);
    }
  }, [agent, apiKey]);

  // Handle http errors (like ConflictError)
  useEffect(() => {
    if (httpErrorMapping) {
      // Navigate to the correct step
      setCurrentStep(httpErrorMapping.step);

      // Set the form error on the specific field
      setError(httpErrorMapping.field, {
        message: httpErrorMapping.message,
      });

      // Wait until the step is set to focus on the field
      setTimeout(() => {
        setFocus(httpErrorMapping.field);
      }, 100);
    }
  }, [httpErrorMapping, setError, setCurrentStep, setFocus]);

  const handleSubmit = async (data: FormData) => {
    try {
      // Clear any previous external errors
      setHttpErrorMapping(null);

      // If "Other" is selected and has a value, add it to the skills array
      const finalSkills =
        data.skills.includes("Other") && data.otherSkill
          ? [
              ...data.skills.filter((skill) => skill !== "Other"),
              data.otherSkill,
            ]
          : data.skills;

      const finalData = {
        ...data,
        skills: finalSkills,
      };

      await onSubmit(finalData);

      toast.success("Agent created successfully");

      form.reset();
    } catch (error) {
      // Try to map the error to a form location
      const errorMapping = mapHttpError(error as Error);

      if (errorMapping) {
        setHttpErrorMapping(errorMapping);
      } else {
        // Fallback to toast for unmapped errors
        toast.error("There was an error creating your agent.");
      }
    }
  };

  return (
    <div className="flex h-full w-full flex-col pt-5">
      <h2 className="text-primary mb-2 w-full text-2xl font-semibold">
        Register an Agent
      </h2>
      <p className="text-secondary-foreground mb-8">
        Create a new AI agent and make it discoverable on the Recall network.
      </p>
      <UnsavedChangesModal
        isOpen={navGuard.active}
        onClose={navGuard.reject}
        onConfirm={navGuard.accept}
      />
      <div className="flex w-full gap-4">
        <div className="w-full lg:w-2/3">
          <Steps currentStep={currentStep} className="mb-8" />

          {currentStep === 3 && agent && apiKey ? (
            <AgentCreated
              agent={agent}
              apiKey={apiKey}
              redirectToUrl={redirectToUrl}
            />
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)}>
                {currentStep === 1 && (
                  <BasicsStep
                    form={form}
                    onNext={() => setCurrentStep(2)}
                    onBack={() => router.push(redirectToUrl)}
                  />
                )}
                {currentStep === 2 && (
                  <SocialsStep
                    form={form}
                    onBack={() => setCurrentStep(1)}
                    isSubmitting={isSubmitting}
                  />
                )}
              </form>
            </Form>
          )}
        </div>
        <div className="hidden h-full w-full items-center justify-center lg:flex lg:w-1/3">
          {currentStep === 1 && (
            <Image
              src="/create-agent-1.png"
              alt="Agent Register"
              width={1000}
              height={1000}
              className="h-full w-full object-cover"
            />
          )}
          {currentStep === 2 && (
            <Image
              src="/create-agent-2.png"
              alt="Agent Register"
              width={1000}
              height={1000}
              className="h-full w-full object-cover"
            />
          )}
          {currentStep === 3 && agent && (
            <div className="flex flex-col items-center justify-center gap-4">
              <AgentCard agent={agent} isLoading={false} />
              <p className="text-secondary-foreground text-center italic">
                Welcome to Recall,{" "}
                <span className="text-primary-foreground">{agent.name}</span>!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
