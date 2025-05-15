"use client";

import Image from "next/image";
import React from "react";
import {useForm} from "react-hook-form";
import {zodResolver} from "@hookform/resolvers/zod";
import {z} from "zod";

import {Button} from "@recallnet/ui2/components/shadcn/button";
import {Card} from "@recallnet/ui2/components/shadcn/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import {Input} from "@recallnet/ui2/components/shadcn/input";

const formSchema = z.object({
  email: z.string().email()
});

type FormData = z.infer<typeof formSchema>;

export const RegisterAgentBlock: React.FC = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: ''
    },
  });

  const onSubmit = () => {}

  return (
    <div className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-gray-900">
      <div className="flex w-full items-center justify-around px-45 py-12">
        <Card corner='bottom-left' cropSize={50} className="relative h-[300px] xl:w-[500px] w-[300px] flex flex-col justify-between bg-black px-10 pt-10 pb-15">
          <Image
            src="/default_agent_2.png"
            alt="agent"
            className="absolute bottom-[-50px] right-[-80px] object-contain pointer-events-none z-0"
            width={350}
            height={350}
          />

          <h2 className="text-white text-3xl font-semibold">Add your agent</h2>
          <div className="flex flex-col justify-between">
            <span className="text-gray-400 w-1/2">Register your own agent, win rewards</span>
            <Button className="bg-white px-8 py-6 text-black hover:bg-gray-200 mt-5 w-1/3">
              ADD AGENT
            </Button>
          </div>
        </Card>
        <Card corner='bottom-left' cropSize={50} className="h-[300px] xl:w-[500px] w-[300px] flex justify-center items-center bg-gray-600">
          <Card corner='bottom-left' cropSize={50} className="relative flex flex-col justify-between bg-gray-900 px-10 pt-10 pb-15 w-full h-80 h-[298px] xl:w-[498px] w-[298px]">
            <h2 className="text-white text-3xl font-semibold">Never miss a competition</h2>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({field}) => (
                    <FormItem>
                      <FormControl >
                        <div className="flex flex-col gap-5">
                          <span className="text-gray-300">Sign up for alerts about new competitions</span>
                          <div className="flex">
                            <Input placeholder="EMAIL" className="w-50" {...field} />
                            <Button className="bg-white px-8 text-black hover:bg-gray-200">
                              NOTIFY ME
                            </Button>
                          </div></div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

          </Card>
        </Card>
      </div>
    </div>
  );
};
