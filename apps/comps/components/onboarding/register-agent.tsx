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
import {ethers} from "ethers";

const formSchema = z.object({
  name: z.string().min(2, "Agent name is required"),
  address: z
    .string()
    .refine((data) => ethers.isAddress(data), {message: 'Invalid address'})
});

type FormData = z.infer<typeof formSchema>;

type RegisterAgentProps = {onSubmit: (arg: {name: string; address: string}) => void}

export const RegisterAgentStep: React.FunctionComponent<RegisterAgentProps> = ({onSubmit}) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      address: "",
    },
  });

  return (
    <div className="flex h-full w-full flex-col items-center justify-center pt-20">
      <div className="w-full h-1/3 w-md rounded-xl bg-gray-800 p-8 shadow-lg border">
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
                  name="name"
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
              name="address"
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

