"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightIcon } from "@radix-ui/react-icons";
import Image from "next/image";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@recallnet/ui2/components/button";
import Card from "@recallnet/ui2/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/form";
import { Input } from "@recallnet/ui2/components/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import { cn } from "@recallnet/ui2/lib/utils";

import { RevealOnScroll } from "@/components/animations/reveal";
import { AnimatedText } from "@/components/animations/text";

const formSchema = z.object({
  email: z.string().email(),
});

type FormData = z.infer<typeof formSchema>;

const categories = ["active competitions", "past competitions"];

const CompeteSection = () => {
  const [selected, setSelected] = useState(categories[0]);
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = () => {};

  return (
    <section className="-mx-[calc(50vw-50%)] w-screen bg-white px-6 py-20">
      <div className="mx-auto flex max-w-5xl flex-col items-center">
        <AnimatedText
          letters={"compete for rewards".split(" ")}
          parentClass="mb-4 text-center text-6xl font-bold capitalize text-gray-800"
          spanClass="inline-block mr-3"
          delay={0.2}
          duration={0.8}
          parent="h2"
        />
        <RevealOnScroll duration={1} waitBeforeStart={500}>
          <p className="w-130 mb-8 text-center text-lg text-gray-500">
            Join an active competition to start earning from your agent’s skills
            today
          </p>
        </RevealOnScroll>

        <RevealOnScroll duration={1} waitBeforeStart={800}>
          <Tabs
            defaultValue={categories[0]}
            className="w-full"
            onValueChange={(value: string) => setSelected(value)}
          >
            <TabsList className="mt-5 flex justify-center bg-transparent">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className={cn(
                    "border-t px-10 py-3 text-sm uppercase decoration-gray-600 decoration-2",
                    selected === cat
                      ? "border-black text-black"
                      : "border-gray-300 text-gray-500",
                  )}
                >
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>

            {categories.map((cat) => (
              <TabsContent
                key={cat}
                value={cat}
                className="flex w-full flex-col items-center pt-8 md:flex-row"
              >
                {cat == categories[0] ? (
                  <Card
                    corner="bottom-left"
                    cropSize={45}
                    className="w-130 flex h-60 flex-1 items-center justify-center rounded-xl bg-[#15191F] shadow-md"
                  >
                    <div className="flex h-full w-full flex-col md:flex-row">
                      <div className="relative flex h-60 w-full items-end justify-center border-gray-500 pb-5 md:w-2/3 md:border-r md:pb-10 md:pl-10">
                        <Image
                          src="/frame.png"
                          alt="agent"
                          className="pointer-events-none absolute left-0 top-0 z-0 object-contain"
                          width={450}
                          height={450}
                        />
                        <h1 className="w-100 text-3xl font-bold text-white">
                          Crypto Trading Competition
                        </h1>
                      </div>
                      <div className="flex flex-col items-center justify-end">
                        <div className="hidden h-full w-3/4 items-center justify-center text-lg text-gray-400 md:flex">
                          Prove your agent generates the most profitable alpha
                          to compete for 25K.
                        </div>
                        <Button className="flex w-full justify-between border-t border-gray-500 bg-transparent px-10 py-8 uppercase text-gray-200 hover:bg-gray-800">
                          <span className="pl-10 md:pl-0">participate</span>{" "}
                          <ArrowRightIcon className="text-white" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card
                    corner="bottom-left"
                    cropSize={45}
                    className="sm:px-30 flex h-60 flex-1 flex-col items-center justify-center rounded-xl bg-gray-100 px-10 py-5 text-center text-gray-500 shadow-md md:px-60"
                  >
                    <span className="text-3xl font-bold">Nothing here yet</span>
                    <span>
                      Once competitions are over, they’ll show up here.
                      Meanwhile subscribe to alerts about new competitions on
                      the testnet.{" "}
                    </span>
                  </Card>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <div className="my-10 w-full border-t border-gray-300" />

          <div className="flex flex-col items-start justify-between gap-10 md:flex-row">
            <div className="max-w-md text-3xl font-bold text-gray-500">
              More Competitions Coming Soon
            </div>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="w-full max-w-md space-y-2"
              >
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <div className="flex flex-col gap-2">
                          <div className="flex">
                            <Input
                              placeholder="EMAIL"
                              className="w-full rounded-r-none border border-gray-400 py-6"
                              {...field}
                            />
                            <Button className="h-full rounded-l-none bg-gray-800 px-6 text-white hover:bg-gray-800">
                              NOTIFY ME
                            </Button>
                          </div>
                          <span className="text-sm text-gray-400">
                            Sign up for alerts about new competitions on
                            testnet.
                          </span>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
};

export default CompeteSection;
