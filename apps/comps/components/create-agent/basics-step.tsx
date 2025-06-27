"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import { Button } from "@recallnet/ui2/components/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui2/components/form";
import { Input } from "@recallnet/ui2/components/input";
import { Textarea } from "@recallnet/ui2/components/textarea";

import { FormData } from "./index";

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

interface BasicsStepProps {
  form: UseFormReturn<FormData>;
  onNext: () => void;
  onBack: () => void;
}

export function BasicsStep({ form, onNext, onBack }: BasicsStepProps) {
  const handleNext = async () => {
    const isValid = await form.trigger([
      "name",
      "description",
      "repositoryUrl",
      "skills",
      "otherSkill",
    ]);
    if (isValid) {
      onNext();
    }
  };

  return (
    <div className="xs:px-16 space-y-6">
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
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Short Description (Optional)</FormLabel>
            <FormControl>
              <Textarea
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
        name="repositoryUrl"
        render={({ field, formState: { errors } }) => (
          <FormItem>
            <FormLabel>Repository URL</FormLabel>
            <FormControl>
              <Input placeholder="E.g.: https://repository.com" {...field} />
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
            <FormDescription>Choose all that apply.</FormDescription>
            <div className="grid grid-cols-2 gap-2 pt-2">
              {AGENT_SKILLS.map((skill) => (
                <label key={skill} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    value={skill}
                    className="h-4 w-4"
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
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" className="px-10" onClick={onBack}>
          BACK
        </Button>
        <Button type="button" onClick={handleNext} className="px-10">
          NEXT
        </Button>
      </div>
    </div>
  );
}
