"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import React, { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { FaPenToSquare } from "react-icons/fa6";
import { z } from "zod";

import { Button } from "@recallnet/ui2/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@recallnet/ui2/components/shadcn/form";
import { Input } from "@recallnet/ui2/components/shadcn/input";
import { Skeleton } from "@recallnet/ui2/components/skeleton";
import { cn } from "@recallnet/ui2/lib/utils";

import { ProfileResponse, UpdateProfileRequest } from "@/types/profile";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address" }),
  website: z
    .string()
    .url({ message: "Must be a valid URL" })
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

type FormData = z.infer<typeof formSchema>;

interface UserInfoSectionProps {
  user: ProfileResponse;
  isLoading: boolean;
  onSave: (data: Partial<UpdateProfileRequest>) => Promise<void>;
}

export default function UserInfoSection({
  user,
  isLoading,
  onSave,
}: UserInfoSectionProps) {
  const [editField, setEditField] = useState<"email" | "website" | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),

    defaultValues: {
      email: user?.email || "",
      website: user?.website || "",
    },
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditField(null);
      form.reset();
    }
  };

  const handleSave: SubmitHandler<FormData> = async (data) => {
    try {
      await onSave(data);
      setEditField(null);
    } catch (error) {
      console.error(`Failed to save:`, error);
    }
  };

  return (
    <div className="h-70 flex w-full border border-gray-500">
      {isLoading || !user?.image ? (
        <Skeleton className="w-[350px]" />
      ) : (
        <Image
          src={user?.image}
          alt="agent"
          className="pointer-events-none hidden h-full sm:block"
          width={350}
          height={350}
        />
      )}
      <div className="flex w-full flex-col items-start justify-center gap-5 p-4">
        {isLoading ? (
          <Skeleton className="h-9 w-60 rounded" />
        ) : (
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-bold">{user?.name}</h2>
            {user?.isVerified && <BadgeCheckIcon className="text-green-500" />}
          </div>
        )}

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="w-full space-y-4"
          >
            {/* Email row */}
            <div className="text-secondary-foreground flex items-center gap-4">
              <span className="w-20 font-semibold text-white">E-mail</span>
              {editField === "email" ? (
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input
                            {...field}
                            className="w-full max-w-sm bg-gray-700"
                            autoFocus
                            onKeyDown={handleKeyDown}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button>Save</Button>
                </div>
              ) : isLoading ? (
                <Skeleton className="h-2 w-60 rounded" />
              ) : (
                <>
                  <FaPenToSquare
                    className="h-5 w-5 cursor-pointer"
                    onClick={() => setEditField("email")}
                  />
                  <span className="ml-8">{user?.email}</span>
                </>
              )}
            </div>

            {/* Website row */}
            <div className="text-secondary-foreground flex items-center gap-4">
              <span className="w-20 font-semibold text-white">Website</span>
              {editField === "website" ? (
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input
                            {...field}
                            className="w-full max-w-sm bg-gray-700"
                            autoFocus
                            onKeyDown={handleKeyDown}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button>Save</Button>
                </div>
              ) : isLoading ? (
                <Skeleton className="h-2 w-60 rounded" />
              ) : (
                <>
                  <FaPenToSquare
                    className="h-5 w-5 cursor-pointer"
                    onClick={() => setEditField("website")}
                  />
                  <span className="ml-8">{user?.website}</span>
                </>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

const BadgeCheckIcon = ({ className }: { className?: string }) => {
  return (
    <svg
      className={cn("h-9 w-9", className)}
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m8.032 12 1.984 1.984 4.96-4.96m4.55 5.272.893-.893a1.984 1.984 0 0 0 0-2.806l-.893-.893a1.984 1.984 0 0 1-.581-1.403V7.04a1.984 1.984 0 0 0-1.984-1.984h-1.262a1.983 1.983 0 0 1-1.403-.581l-.893-.893a1.984 1.984 0 0 0-2.806 0l-.893.893a1.984 1.984 0 0 1-1.403.581H7.04A1.984 1.984 0 0 0 5.055 7.04v1.262c0 .527-.209 1.031-.581 1.403l-.893.893a1.984 1.984 0 0 0 0 2.806l.893.893c.372.372.581.876.581 1.403v1.262a1.984 1.984 0 0 0 1.984 1.984h1.262c.527 0 1.031.209 1.403.581l.893.893a1.984 1.984 0 0 0 2.806 0l.893-.893a1.985 1.985 0 0 1 1.403-.581h1.262a1.984 1.984 0 0 0 1.984-1.984V15.7c0-.527.209-1.031.581-1.403Z"
      />
    </svg>
  );
};
