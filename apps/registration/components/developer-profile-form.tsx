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
      <div className="container relative mx-auto flex max-w-6xl flex-col items-center justify-center px-4">
        <div className="flex w-[465px] flex-col items-center gap-8">
          {/* Header */}
          <div className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center justify-start gap-8">
              <div className="font-['Trim_Mono',monospace] text-xl font-semibold leading-[26px] text-[#E9EDF1]">
                Step 1 of 3
              </div>
              <div className="flex items-center gap-4 rounded-full p-2">
                <div className="h-4 w-4 rounded-full bg-[#62A0DD]"></div>
                <div className="h-4 w-4 rounded-full bg-[#1D1F2B]"></div>
                <div className="h-4 w-4 rounded-full bg-[#1D1F2B]"></div>
              </div>
            </div>
            <h1 className="font-['Replica_LL',sans-serif] text-4xl font-bold leading-[57.6px] text-[#E9EDF1] md:text-5xl">
              Developer Profile
            </h1>
          </div>

          {/* Form */}
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
                    <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
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
                    <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
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
                        We&apos;ll email your API key here - make sure it&apos;s
                        one you check often.
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
                    <FormLabel className="font-['Replica_LL',sans-serif] text-base leading-6 tracking-wider text-[#93A5BA]">
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
              <div className="flex w-full items-center justify-between pt-4">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 border border-[#303846] px-6 py-4 text-[#303846] hover:bg-[#303846] hover:text-white"
                  >
                    <ChevronLeft size={16} />
                    <span className="font-['Trim_Mono',monospace] text-xs font-semibold uppercase tracking-[1.56px]">
                      Back
                    </span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={updateProfile.isPending}
                  className="ml-auto bg-[#0057AD] px-8 py-3 font-['Trim_Mono',monospace] text-sm font-semibold uppercase tracking-wider text-white hover:bg-[#0066cc] disabled:bg-gray-400"
                >
                  {updateProfile.isPending ? "Saving..." : "Continue"}
                </button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}
