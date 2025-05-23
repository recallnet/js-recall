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

import { UpdateProfileRequest } from "@/types/profile";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email({ message: "Invalid email address" }),
  website: z
    .string()
    .url({ message: "Must be a valid URL" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
  image: z
    .string()
    .url({ message: "Must be a valid URL" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type FormData = z.infer<typeof formSchema>;

type UpdateProfileProps = {
  onSubmit: (data: UpdateProfileRequest) => void;
};

export const UpdateProfile: React.FC<UpdateProfileProps> = ({ onSubmit }) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      website: "",
      image: "",
    },
  });

  return (
    <div className="flex h-full w-full flex-col pt-5">
      <h2 className="text-primary mb-4 w-full text-start text-2xl font-semibold">
        Update Your Profile
      </h2>
      <p className="text-secondary-foreground mb-8">
        It looks like you&apos;re new here! Complete the form below to update
        your profile.
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: Walter White" {...field} />
                </FormControl>
                {!errors.name && (
                  <FormDescription>
                    The name you go by professionally, or how you&apos;d like to
                    be known.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="E.g.: walterwhite@gmail.com" {...field} />
                </FormControl>
                {!errors.email && (
                  <FormDescription>
                    We&apos;ll email your API key here - make sure it&apos;s one
                    you check often.
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>GitHub or Website (optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g.: https://walterwhite.com"
                    {...field}
                  />
                </FormControl>
                {!errors.website && (
                  <FormDescription>
                    So others can learn more about you and your work!
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="image"
            render={({ field, formState: { errors } }) => (
              <FormItem>
                <FormLabel>Profile Picture (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="E.g.: https://example.com/avatar.png"
                    {...field}
                  />
                </FormControl>
                {!errors.image && (
                  <FormDescription>
                    So others can learn more about you and your work!
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              className="rounded bg-blue-700 px-8 py-3 text-white hover:bg-blue-800 disabled:bg-gray-400"
            >
              UPDATE PROFILE
            </button>
          </div>
        </form>
      </Form>
    </div>
  );
};
