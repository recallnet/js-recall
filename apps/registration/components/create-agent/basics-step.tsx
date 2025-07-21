"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import { Button } from "@recallnet/ui/components/shadcn/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui/components/shadcn/form";
import { Input } from "@recallnet/ui/components/shadcn/input";
import { Textarea } from "@recallnet/ui/components/shadcn/textarea";
import {
  SKILL_OPTIONS,
  skillsToKeys,
  type SkillDisplay,
} from "@recallnet/ui/lib/skills";

import { FormData } from "./index";

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
    <div className="space-y-6 px-4 sm:px-16">
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
              {SKILL_OPTIONS.map((skill) => {
                // Convert display names to keys for form value comparison and storage
                const skillKey = skillsToKeys([skill])[0];
                const isChecked = field.value.includes(skillKey) || field.value.includes(skill);
                
                return (
                  <label key={skill} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={skillKey}
                      className="h-4 w-4"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // Store the skill key (e.g., "trading") not display name
                          field.onChange([...field.value.filter((s: string) => s !== skill && s !== skillKey), skillKey]);
                        } else {
                          // Remove both key and display name variants
                          field.onChange(
                            field.value.filter((s: string) => s !== skill && s !== skillKey),
                          );
                        }
                      }}
                    />
                    <span className="text-sm text-gray-400">{skill}</span>
                  </label>
                );
              })}
            </div>
            {(field.value.includes("Other") || field.value.includes("other")) && (
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