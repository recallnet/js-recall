"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft } from "lucide-react";
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
} from "@recallnet/ui/components/shadcn/form";
import { Input } from "@recallnet/ui/components/shadcn/input";

import { useUpdateProfile } from "../hooks/useProfile";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email({ message: "Invalid email address" }),
  website: z
    .string()
    .url({ message: "Must be a valid URL" })
    .optional()
    .or(z.literal("")),
});

export type ProfileFormData = z.infer<typeof formSchema>;

interface DeveloperProfileFormProps {
  initialData?: ProfileFormData;
  onBack?: () => void;
  onNext?: (data: ProfileFormData) => void;
}

/**
 * DeveloperProfileForm component
 *
 * Form to collect developer profile information
 *
 * @param initialData - Initial data to populate the form with
 * @param onBack - Function to call when back button is clicked
 * @param onNext - Function to call when next button is clicked
 */
export default function DeveloperProfileForm({
  initialData,
  onBack,
  onNext,
}: DeveloperProfileFormProps) {
  const updateProfile = useUpdateProfile();

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      website: initialData?.website || "",
    },
  });

  const handleSubmit = async (data: ProfileFormData) => {
    try {
      const transformedData = {
        name: data.name,
        email: data.email,
        metadata: data.website ? { website: data.website } : undefined,
        // Note: description is not part of the standard profile API
        // You may need to add it to metadata if needed
      };

      await updateProfile.mutateAsync(transformedData);

      if (onNext) {
        onNext(data);
      }
    } catch (error) {
      console.error("Failed to update profile:", error);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#050507] py-8">
      <div className="container mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        <div className="flex w-full max-w-3xl flex-col items-center gap-14">
          {/* Title section */}
          <div className="text-center">
            <h1 className="mb-3 font-['Replica_LL',sans-serif] text-4xl font-bold text-[#E9EDF1] md:text-6xl">
              Developer Profile
            </h1>
            <p className="mx-auto max-w-2xl font-['Replica_LL',sans-serif] text-lg tracking-wide text-[#596E89] md:text-xl">
              Tell us about yourself to complete your registration.
            </p>
          </div>

          {/* Form section */}
          <div className="flex w-full max-w-xl flex-col gap-5">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(handleSubmit)}
                className="flex w-full flex-col gap-7"
              >
                {/* Name Field */}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field, formState: { errors } }) => (
                    <FormItem>
                      <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#596E89]">
                        Name *
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g.: Walter White"
                          {...field}
                          className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                        />
                      </FormControl>
                      {!errors.name && (
                        <FormDescription className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                          The name you go by professionally, or how you&apos;d
                          like to be known.
                        </FormDescription>
                      )}
                      <FormMessage className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Email Field */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field, formState: { errors } }) => (
                    <FormItem>
                      <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#596E89]">
                        Email *
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="E.g.: walterwhite@gmail.com"
                          {...field}
                          className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                        />
                      </FormControl>
                      {!errors.email && (
                        <FormDescription className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                          We&apos;ll email your API key here - make sure
                          it&apos;s one you check often.
                        </FormDescription>
                      )}
                      <FormMessage className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Website Field */}
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#596E89]">
                        GitHub or Website (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="E.g.: https://walterwhite.com"
                          {...field}
                          className="w-full rounded-md border border-[#43505F] bg-[#1D1F2B] px-3 py-2 font-['Replica_LL',sans-serif] text-lg text-white placeholder:text-[#43505F] focus:border-[#62A0DD] focus:outline-none"
                        />
                      </FormControl>
                      <FormDescription className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-[#596E89]">
                        So others can learn more about you and your work!
                      </FormDescription>
                      <FormMessage className="font-['Replica_LL',sans-serif] text-sm leading-[21px] tracking-[0.42px] text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Action Buttons */}
                <div className="flex w-full flex-col gap-5 pt-4">
                  <button
                    type="submit"
                    disabled={updateProfile.isPending}
                    className="w-full rounded-none bg-[#0057AD] py-5 transition-colors hover:bg-[#0066cc] disabled:bg-gray-400"
                  >
                    <span className="font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-[#E9EDF1]">
                      {updateProfile.isPending
                        ? "Saving..."
                        : "Complete Profile"}
                    </span>
                  </button>

                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      className="flex w-full items-center justify-center gap-2 border border-[#596E89] py-3 text-[#596E89] transition-colors hover:bg-[#596E89] hover:text-white"
                    >
                      <ChevronLeft size={16} />
                      <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px]">
                        Back
                      </span>
                    </button>
                  )}
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
