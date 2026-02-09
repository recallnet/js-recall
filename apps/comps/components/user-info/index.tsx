import { zodResolver } from "@hookform/resolvers/zod";
import { useClickAway } from "@uidotdev/usehooks";
import Link from "next/link";
import React, { useEffect, useState } from "react";
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
import type { RouterOutputs } from "@/rpc/router";
import { UpdateProfileRequest } from "@/types/profile";
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
    z
      .string()
      .url({ message: "Must be a valid URL (e.g., https://example.com)" }),
  ).refine(
    (url) => {
      if (!url) return true; // Allow empty/undefined values after transformation
      try {
        const parsedUrl = new URL(url);
        return parsedUrl.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Website must use HTTPS (e.g., https://example.com)" },
  ),
});

type FormData = z.infer<typeof formSchema>;

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-foreground content-center text-sm font-semibold">
    {children}
  </span>
);

const FieldValue = ({ children }: { children: React.ReactNode }) => (
  <div className="text-secondary-foreground flex content-center items-center gap-2">
    {children}
  </div>
);

interface UserInfoSectionProps {
  user: RouterOutputs["user"]["getProfile"];
  onSave: (data: Partial<UpdateProfileRequest>) => Promise<void>;
  onLinkWallet: () => Promise<void>;
}

export default function UserInfoSection({
  user,
  onSave,
  onLinkWallet,
}: UserInfoSectionProps) {
  const [editField, setEditField] = useState<"name" | "website" | null>(null);

  // Click away ref to dismiss edit mode for any field
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

  // Reset form values when user data changes
  useEffect(() => {
    form.reset({
      name: user?.name || "",
      website: user?.metadata?.website || "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.name, user?.metadata]);

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
        // Always send metadata when editing website field to support clearing it
        metadata:
          editField === "website" ? { website: data.website } : undefined,
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
    <div className="flex w-full rounded-xl border">
      <ProfilePicture
        image={user?.imageUrl ?? undefined}
        onSave={async (newUrl) => {
          await onSave({ imageUrl: newUrl });
        }}
        className="w-90 my-auto hidden sm:block sm:rounded-l-xl"
        fallbackData={{
          walletAddress: user?.walletAddress,
          name: user?.name ?? undefined,
        }}
      />
      <div className="flex w-full flex-col items-start justify-center gap-2 p-4 sm:border-l">
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="flex w-full flex-col gap-2"
          >
            {editField === "name" ? (
              <div ref={editFieldRef} className="flex items-center gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field, fieldState }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input
                          {...field}
                          className="w-full max-w-sm text-2xl font-bold"
                          autoFocus
                          onKeyDown={handleKeyDown}
                        />
                      </FormControl>
                      {fieldState.error && (
                        <p className="text-sm text-red-500">
                          {fieldState.error.message}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
                <Button type="submit">Save</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold">{user?.name}</h2>
                <EditButton
                  onClick={() => setEditField("name")}
                  size={20}
                  iconClassName="text-gray-500 hover:text-gray-300"
                />
              </div>
            )}

            <div className="grid w-full auto-rows-[minmax(theme(spacing.8),auto)] grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
              <FieldLabel>Email</FieldLabel>
              <FieldValue>{user?.email ?? "N/A"}</FieldValue>

              <FieldLabel>Website</FieldLabel>
              {editField === "website" ? (
                <div ref={editFieldRef} className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({ field, fieldState }) => (
                      <FormItem className="w-full">
                        <FormControl>
                          <Input
                            {...field}
                            className="w-full max-w-sm"
                            autoFocus
                            onKeyDown={handleKeyDown}
                          />
                        </FormControl>
                        {fieldState.error && (
                          <p className="text-sm text-red-500">
                            {fieldState.error.message}
                          </p>
                        )}
                      </FormItem>
                    )}
                  />
                  <Button type="submit">Save</Button>
                </div>
              ) : (
                <FieldValue>
                  {user?.metadata?.website && (
                    <Link
                      href={user.metadata.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="truncate underline hover:text-gray-300"
                    >
                      {user.metadata.website}
                    </Link>
                  )}
                  <EditButton
                    onClick={() => setEditField("website")}
                    size={20}
                    iconClassName="text-gray-500 hover:text-gray-300"
                  />
                </FieldValue>
              )}

              <FieldLabel>Wallet address</FieldLabel>
              <FieldValue>
                <LinkWallet user={user} onLinkWallet={onLinkWallet} />
              </FieldValue>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
