"use client";

import {zodResolver} from "@hookform/resolvers/zod";
import {CircleAlertIcon, SquarePen} from "lucide-react";
import React, {useState} from "react";
import {SubmitHandler, useForm} from "react-hook-form";
import {z} from "zod";

import {Button} from "@recallnet/ui2/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@recallnet/ui2/components/form";
import {Input} from "@recallnet/ui2/components/input";

import {ProfileResponse, UpdateProfileRequest} from "@/types/profile";
import {asOptionalStringWithoutEmpty} from "@/utils";

import {ProfilePicture} from "./ProfilePicture";
import {toast} from "@/../../packages/ui2/src/components/toast";

const formSchema = z.object({
  email: z.string().email({message: "Invalid email address"}),
  website: asOptionalStringWithoutEmpty(
    z.string().url({message: "Must be a valid URL"}),
  ),
});

type FormData = z.infer<typeof formSchema>;

interface UserInfoSectionProps {
  user: ProfileResponse["user"];
  onSave: (data: Partial<UpdateProfileRequest>) => Promise<void>;
}

export default function UserInfoSection({
  user,
  onSave,
}: UserInfoSectionProps) {
  const [editField, setEditField] = useState<"email" | "website" | null>(null);
  const [emailVerifyClicked, setEmailVerifyClicked] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),

    defaultValues: {
      email: user?.email || "",
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
        email: data.email,
        metadata: data.website ? {website: data.website} : undefined,
      };

      await onSave(transformedData);
      setEditField(null);
    } catch (error) {
      console.error(`Failed to save:`, error);
    }
  };

  const sendEmailVerify = () => {
    //setEmailVerifyClicked(true)

    toast.success(
      <div className="flex flex-col">
        <span>Verification Email Sent</span>
        <span className="text-primary-foreground font-normal">An email has been sent to your inbox.</span>
      </div>
    )
    //setTimeout(setEmailVerifyClicked, 60 * 1000, false) //wait 60 seconds
  }
  console.log(emailVerifyClicked)

  return (
    <div className="flex w-full border">
      <ProfilePicture
        image={user?.imageUrl}
        onSave={async (newUrl) => {
          await onSave({imageUrl: newUrl});
        }}
        className="w-90"
      />
      <div className="flex w-full flex-col items-start justify-center gap-5 border-l p-4">
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-bold">{user?.name}</h2>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSave)}
            className="w-full space-y-4"
          >
            {/* Email row */}
            <div className="text-secondary-foreground flex flex-wrap items-center gap-4">
              <span className="text-foreground w-20 font-semibold">E-mail</span>
              {editField === "email" ? (
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({field}) => (
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
                  <SquarePen
                    className="h-5 w-5 cursor-pointer"
                    onClick={() => setEditField("email")}
                  />
                  <span>{user?.email}</span>
                  {
                    //TODO still need "verified" field to put this conditionally
                  }
                  <div className="flex items-center gap-2">
                    <CircleAlertIcon className="text-yellow-400" />
                    <Button variant='link' className="underline p-0" onClick={sendEmailVerify} disabled={emailVerifyClicked}>
                      Verify
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Website row */}
            <div className="text-secondary-foreground flex flex-wrap items-center gap-4">
              <span className="text-foreground w-20 font-semibold">
                Website
              </span>
              {editField === "website" ? (
                <div className="flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="website"
                    render={({field}) => (
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
                  <SquarePen
                    className="h-5 w-5 cursor-pointer"
                    onClick={() => setEditField("website")}
                  />
                  <span>{user?.metadata?.website}</span>
                </>
              )}
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
