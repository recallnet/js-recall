"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import React from "react";
import { useForm } from "react-hook-form";
import { isAddress } from "viem";
import { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import { Input } from "@recallnet/ui2/components/shadcn/input";

const formSchema = z.object({
  name: z.string().min(2, "Agent name is required"),
  address: z
    .string()
    .refine((data) => isAddress(data), { message: "Invalid address" }),
});

type FormData = z.infer<typeof formSchema>;

type RegisterAgentProps = {
  onSubmit: (arg: { name: string; address: string }) => void;
};

export const RegisterAgentStep: React.FunctionComponent<RegisterAgentProps> = ({
  onSubmit,
}) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center pt-20">
      <div className="w-md h-1/3 w-full rounded-xl border bg-gray-800 p-8 shadow-lg">
        <h2 className="text-primary mb-4 w-full text-start text-2xl font-semibold">
          Register Your Agent
        </h2>

        <div className="mb-6 space-y-2">
          <div className="h-2 w-3/4 rounded bg-gray-500"></div>
          <div className="h-2 w-1/2 rounded bg-gray-500"></div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-start gap-6">
              <div className="h-31 w-31 flex items-center justify-center rounded bg-gray-700">
                <span className="text-gray-300">Placeholder</span>
              </div>

              <div className="flex w-full flex-col justify-between md:w-1/2">
                <div className="mb-4 flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-blue-500" />
                  <div className="h-8 w-8 rounded-full bg-green-500" />
                  <div className="h-8 w-8 rounded-full bg-red-500" />
                  <div className="h-8 w-8 rounded-full bg-purple-500" />
                </div>

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Agent Name</FormLabel>
                      <FormControl>
                        <Input placeholder="AGENT NAME" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origin Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="pt-4">
              <button
                type="submit"
                className="w-full bg-sky-700 py-4 text-white hover:bg-blue-700 disabled:bg-gray-400"
              >
                CONTINUE
              </button>
            </div>
          </form>
        </Form>
      </div>

      <div className="mt-6">
        <Link
          href="https://docs.recall.com"
          target="_blank"
          className="text-primary cursor-pointer text-sm"
        >
          {"RECALL DOCS ->"}
        </Link>
      </div>
    </div>
  );
};
