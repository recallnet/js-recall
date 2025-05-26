"use client";

import Image from "next/image";
import {FooterSection} from "@/components/footer-section";
import {zodResolver} from "@hookform/resolvers/zod";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/shadcn/form";
import {Input} from "@recallnet/ui2/components/shadcn/input";
import {Button} from "@recallnet/ui2/components/shadcn/button";


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
    <div className="relative w-full bg-black text-white flex flex-col justify-between items-start py-40 px-20 overflow-hidden">
      {/* Left content */}
      <div className="max-w-xl z-10">
        <h2 className="text-7xl font-bold mb-6">Subscribe</h2>
        <p className="text-gray-400 mb-8 w-90"> Sign up to hear about new competitions and big announcements</p>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="email"
              render={({field}) => (
                <FormItem>
                  <FormControl>
                    <div className="flex">
                      <Input
                        placeholder="EMAIL"
                        className="w-70 border-2 border-white py-6"
                        {...field}
                      />
                      <Button className="bg-white px-8 text-black hover:bg-gray-200 h-full">
                        NOTIFY ME
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
      <div className="absolute top-[-250] right-0 w-[1000px] h-[1000px]">
        <Image
          src={"/frame_4.png"}
          alt="Subscribe illustration"
          fill
          className="object-contain"
        />
      </div>
      <FooterSection className="mt-40" />
    </div>
  );
};

