"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/shadcn/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import { Input } from "@recallnet/ui2/components/shadcn/input";

const formSchema = z.object({
  email: z.string().email(),
});

type FormData = z.infer<typeof formSchema>;

export const NewsletterSection: React.FC = () => {
  const [email, setEmail] = useState("");
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit = () => {
    console.log("Subscribing email:", email);
    setEmail("");
  };

  return (
    <Card
      corner="bottom-left"
      cropSize={50}
      className="flex h-[300px] w-[450px] items-center justify-center bg-gray-600"
    >
      <Card
        corner="bottom-left"
        cropSize={50}
        className="pb-15 relative flex h-[298px] w-[448px] flex-col justify-between bg-gray-900 px-10 pt-10"
      >
        <h2 className="text-3xl font-semibold text-white">
          Never miss a competition
        </h2>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <div className="flex flex-col gap-5">
                      <span className="text-gray-300">
                        Sign up for alerts about new competitions
                      </span>
                      <div className="flex">
                        <Input
                          placeholder="EMAIL"
                          className="w-50"
                          {...field}
                        />
                        <Button className="h-full bg-white px-8 text-black hover:bg-gray-200">
                          NOTIFY ME
                        </Button>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </Card>
    </Card>
  );
};
