"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";

import { Button } from "@recallnet/ui2/components/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui2/components/form";
import { Input } from "@recallnet/ui2/components/input";

import { FormData } from ".";
import { ImagePreview } from "./image-preview";

interface SocialsStepProps {
  form: UseFormReturn<FormData>;
  onBack: () => void;
  isSubmitting?: boolean;
}

export function SocialsStep({ onBack, isSubmitting, form }: SocialsStepProps) {
  return (
    <div className="xs:px-16 space-y-6">
      <FormField
        control={form.control}
        name="imageUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Avatar (Optional)</FormLabel>
            <div className="mt-4 flex items-center gap-6">
              <ImagePreview imageUrl={field.value} />
              <div className="flex w-full items-center">
                <FormControl>
                  <Input
                    placeholder="Enter your avatar URL..."
                    {...field}
                    value={field.value ?? ""}
                    className="rounded-r-none"
                  />
                </FormControl>
              </div>
            </div>
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
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onBack} className="px-10">
          BACK
        </Button>
        <Button type="submit" disabled={isSubmitting} className="px-10">
          {isSubmitting ? "SUBMITTING..." : "SUBMIT"}
        </Button>
      </div>
    </div>
  );
}
