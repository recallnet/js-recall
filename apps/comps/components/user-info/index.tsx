"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useClickAway } from "@uidotdev/usehooks";
import React, { useState } from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@recallnet/ui2/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@recallnet/ui2/components/form";
import { Input } from "@recallnet/ui2/components/input";
import { toast } from "@recallnet/ui2/components/toast";

import { ConflictError } from "@/lib/api-client";
import { ProfileResponse, UpdateProfileRequest } from "@/types/profile";
import { asOptionalStringWithoutEmpty } from "@/utils";

import { EditButton } from "../edit-button";
import { ProfilePicture } from "./ProfilePicture";
import LinkWallet from "./link-wallet";

const formSchema = z.object({
  name: z
    .string()
    .min(1, { message: "Name is required" })
    .max(100, { message: "Name must be less than 100 characters" }),
  website: asOptionalStringWithoutEmpty(
    z.string().url({ message: "Must be a valid URL" }),
  ),
});

type FormData = z.infer<typeof formSchema>;

interface UserInfoSectionProps {
  user: ProfileResponse["user"];
  onSave: (data: Partial<UpdateProfileRequest>) => Promise<void>;
  onLinkWallet: () => Promise<void>;
}

export default function UserInfoSection({
  user,
  onSave,
  onLinkWallet,
}: UserInfoSectionProps) {
  const [editField, setEditField] = useState<"name" | "website" | null>(null);

  // Click away ref to dismiss edit mode
  const editFieldRef = useClickAway<HTMLDivElement>(() => {
    if (editField) {
      setEditField(null);
      form.reset();
    }
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: user?.name || "",
      website: user?.metadata?.website || "",
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
      const transformedData: UpdateProfileRequest = {
        name: data.name,
        metadata: data.website ? { website: data.website } : undefined,
      };

      await onSave(transformedData);
      setEditField(null);
    } catch (error: unknown) {
      // Handle ConflictError (409) for duplicate emails
      if (
        error instanceof ConflictError &&
        error.message.toLowerCase().includes("email")
      ) {
        toast.error("Profile Update Failed", {
          description: error.message,
        });
      } else {
        toast.error("Profile Update Failed", {
          description:
            error instanceof Error
              ? error.message
              : "An unexpected error occurred",
        });
      }
    }
  };

  return (
    <div className="flex w-full border">
      <ProfilePicture
        image={user?.imageUrl}
        onSave={async (newUrl) => {
          await onSave({ imageUrl: newUrl });
        }}
        className="w-90 my-auto hidden sm:block"
        fallbackData={{
          walletAddress: user?.walletAddress,
          name: user?.name,
        }}
      />
      <div className="flex w-full flex-col items-start justify-center gap-2 border-l p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold">{user?.name}</h2>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="w-full space-y-2"
          >
            {/* Email row (not editable) */}
            <div className="text-secondary-foreground flex min-h-[30px] items-center gap-4">
              <span className="text-foreground w-20 text-sm font-semibold">
                Email
              </span>
              <span className="text-sm">{user?.email}</span>
            </div>

            {/* Website row */}
            <div className="text-secondary-foreground flex min-h-[30px] items-center gap-4">
              <span className="text-foreground w-20 text-sm font-semibold">
                Website
              </span>
              {editField === "website" ? (
                <div ref={editFieldRef} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input
                            {...field}
                            className="w-full max-w-sm"
                            autoFocus
                            onKeyDown={handleKeyDown}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <Button>Save</Button>
                </div>
              ) : (
                <>
                  {user.metadata?.website && (
                    <a
                      href={user.metadata.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white underline hover:text-gray-300"
                    >
                      {user.metadata.website}
                    </a>
                  )}
                  <EditButton
                    onClick={() => setEditField("website")}
                    size={20}
                    iconClassName="text-gray-500 hover:text-gray-300"
                  />
                </>
              )}
            </div>
          </form>

          {/* Link wallet button. Note: for now, we only allow for linking wallets */}
          <div className="text-secondary-foreground flex min-h-[30px] items-center gap-4">
            <span className="text-foreground w-20 text-sm font-semibold">
              Wallet address
            </span>
            <LinkWallet user={user} onLinkWallet={onLinkWallet} />
          </div>
        </Form>
      </div>
    </div>
  );
}
