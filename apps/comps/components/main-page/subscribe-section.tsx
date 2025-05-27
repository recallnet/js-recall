"use client";

import {zodResolver} from "@hookform/resolvers/zod";
import Image from "next/image";
import {useForm} from "react-hook-form";
import {z} from "zod";

import {Button} from "@recallnet/ui2/components/shadcn/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import {Input} from "@recallnet/ui2/components/shadcn/input";

import {FooterSection} from "@/components/footer-section";

const formSchema = z.object({
  email: z.string().email(),
});

type FormData = z.infer<typeof formSchema>;

export const SubscribeSection = () => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = () => {};

  return (
    <div className="relative w-screen flex w-full flex-col items-center justify-between overflow-hidden bg-black py-40 text-white md:items-start md:px-30 px-0">
      {/* Left content */}
      <div className="z-10 max-w-xl">
        <h2 className="mb-6 text-7xl font-bold">Subscribe</h2>
        <p className="w-90 mb-8 text-gray-400">
          {" "}
          Sign up to hear about new competitions and big announcements
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({field}) => (
                <FormItem>
                  <FormControl>
                    <div className="flex">
                      <Input
                        placeholder="EMAIL"
                        className="md:w-70 w-50 border-1 border-gray-500 py-6"
                        {...field}
                      />
                      <Button className="uppercase h-full bg-white px-8 text-black hover:bg-gray-200">
                        sign up
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
      </div>

      {/* Right image */}
      <div className="absolute hidden md:block h-[1000px] w-[1000px] right-[-300] top-[-250] md:right-[-600] lg:right-[-250] 2xl:right-0">
        <Image
          src={"/frame_4.png"}
          alt="Subscribe illustration"
          fill
          className="object-contain z-10"
        />
      </div>
      <FooterSection className="mt-40 w-full" />
    </div>
  );
};
