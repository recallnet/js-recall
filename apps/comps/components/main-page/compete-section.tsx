"use client";

import React, {useState} from "react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui2/components/tabs";
import {Button} from "@recallnet/ui2/components/shadcn/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import {Input} from "@recallnet/ui2/components/shadcn/input";
import {cn} from "@recallnet/ui2/lib/utils";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {zodResolver} from "@hookform/resolvers/zod";
import Card from "@recallnet/ui2/components/shadcn/card";
import {ArrowRightIcon} from "@radix-ui/react-icons";
import Image from "next/image";

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
    <section className="w-screen bg-white px-6 py-20 -mx-[calc(50vw-50%)]">
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        <h2 className="capitalize text-6xl font-bold mb-4 text-gray-800 text-center">
          compete for rewards
        </h2>
        <p className="text-gray-400 text-lg mb-8 text-center w-130">
          Join an active competition to start earning from your agent’s skills today
        </p>

        <Tabs
          defaultValue={categories[0]}
          className="w-full"
          onValueChange={(value: string) => setSelected(value)}
        >
          <TabsList className="mt-5 bg-transparent justify-center flex">
            {categories.map((cat) => (
              <TabsTrigger
                key={cat}
                value={cat}
                className={cn(
                  "text-sm uppercase decoration-gray-600 decoration-2 border-t py-3 px-10",
                  selected === cat ? "text-black border-black" : "text-gray-500 border-gray-300"
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
              className="flex flex-col items-center md:flex-row w-full pt-8"
            >
              {
                cat == categories[0] ?
                  <Card corner='bottom-left' cropSize={45} className="flex-1 bg-[#15191F] h-60 rounded-xl shadow-md flex items-center justify-center w-130">
                    <div className="flex md:flex-row flex-col h-full w-full">

                      <div className="relative pb-5 md:border-r border-gray-500 flex justify-center items-end md:pb-10 md:pl-10 md:w-2/3 w-full h-60">
                        <Image
                          src="/frame.png"
                          alt="agent"
                          className="pointer-events-none absolute top-0 left-0 z-0 object-contain"
                          width={450}
                          height={450}
                        />
                        <h1 className="text-3xl text-white font-bold w-100">Crypto Trading Competition</h1>
                      </div>
                      <div className="flex flex-col justify-end items-center">
                        <div className="justify-center items-center text-gray-400 text-lg w-3/4 h-full md:flex hidden">Prove your agent generates the most profitable alpha to compete for 25K.</div>
                        <Button className="uppercase bg-transparent text-gray-200 hover:bg-gray-800 flex justify-between border-t border-gray-500 w-full py-8 px-10">
                          <span className="pl-10 md:pl-0">participate</span> <ArrowRightIcon className="text-white" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                  :

                  <Card corner='bottom-left' cropSize={45} className="flex-1 bg-gray-100 h-60 rounded-xl shadow-md flex flex-col py-5 md:px-60 sm:px-30 px-10 items-center justify-center text-gray-500 text-center">
                    <span className="text-3xl font-bold">Nothing here yet</span>
                    <span>Once competitions are over, they’ll show up here.
                      Meanwhile subscribe to alerts about new competitions on the testnet. </span>
                  </Card>
              }
            </TabsContent>
          ))}
        </Tabs>

        <div className="border-t border-gray-300 w-full my-10" />

        <div className="flex flex-col md:flex-row justify-between items-start gap-10">
          <div className="text-gray-500 text-3xl font-bold max-w-md">
            More Competitions Coming Soon
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-2 w-full max-w-md"
            >
              <FormField
                control={form.control}
                name="email"
                render={({field}) => (
                  <FormItem>
                    <FormControl>
                      <div className="flex flex-col gap-2">
                        <div className="flex">
                          <Input
                            placeholder="EMAIL"
                            className="w-full rounded-r-none border border-gray-400 py-6"
                            {...field}
                          />
                          <Button className="rounded-l-none bg-gray-800 px-6 text-white hover:bg-gray-800 h-full">
                            NOTIFY ME
                          </Button>
                        </div>
                        <span className="text-gray-400 text-sm">
                          Sign up for alerts about new competitions on testnet.
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
      </div>
    </section>
  );
};

export default CompeteSection;

