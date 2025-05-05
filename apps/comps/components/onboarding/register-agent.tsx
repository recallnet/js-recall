"use client";

import React from "react";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";
import {useForm} from "react-hook-form";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";

import {Input} from "@recallnet/ui2/components/shadcn/input";
import Link from "next/link";

// Validation schema
const formSchema = z.object({
  agentName: z.string().min(2, "Agent name is required"),
  originAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
});

type FormData = z.infer<typeof formSchema>;

export const RegisterAgentStep = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      agentName: "",
      originAddress: "",
    },
  });

  const onSubmit = (values: FormData) => {
    console.log("Submitted:", values);
  };

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center">
      <div className="w-full w-md rounded-xl bg-gray-800 p-8 shadow-lg">
        <h2 className="mb-4 text-start text-2xl font-semibold text-primary w-full">
          Register Your Agent
        </h2>

        <div className="mb-6 space-y-2">
          <div className="h-2 w-3/4 rounded bg-gray-500"></div>
          <div className="h-2 w-1/2 rounded bg-gray-500"></div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="flex justify-start gap-6">
              <div className="flex h-40 w-40 items-center justify-center rounded bg-gray-700">
                <span className="text-gray-300">Placeholder</span>
              </div>

              <div className="w-full md:w-1/2">
                <div className="mb-4 flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-blue-500" />
                  <div className="h-6 w-6 rounded-full bg-green-500" />
                  <div className="h-6 w-6 rounded-full bg-red-500" />
                </div>

                <FormField
                  control={form.control}
                  name="agentName"
                  render={({field}) => (
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

            {/* Origin Address */}
            <FormField
              control={form.control}
              name="originAddress"
              render={({field}) => (
                <FormItem>
                  <FormLabel>Origin Address</FormLabel>
                  <FormControl>
                    <Input placeholder="0x..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
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

      {/* Bottom Link */}
      <div className="mt-6">
        <Link
          href="https://docs.recall.com"
          target="_blank"
          className="text-sm text-primary cursor-pointer"
        >
          {"RECALL DOCS ->"}
        </Link>
      </div>
    </div>
  );
};

