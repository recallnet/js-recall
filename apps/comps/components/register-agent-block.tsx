"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { usePathname } from "next/navigation";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@recallnet/ui2/components/button";
import { Card } from "@recallnet/ui2/components/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@recallnet/ui2/components/form";
import { Input } from "@recallnet/ui2/components/input";

import { useUserSession } from "@/hooks/useAuth";

import { ConnectWalletModal } from "./modals/connect-wallet";
import { SetupAgentModal } from "./modals/setup-agent";

const formSchema = z.object({
  email: z.string().email(),
});

type FormData = z.infer<typeof formSchema>;

export const RegisterAgentBlock: React.FC = () => {
  const pathname = usePathname();
  const session = useUserSession();
  const [activeModal, setActiveModal] = useState<
    "connectWallet" | "setupAgent" | null
  >(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleAddAgent = () => {
    if (!session.isInitialized) {
      return;
    }

    if (!session.isAuthenticated) {
      setActiveModal("connectWallet");
      return;
    }

    // If user is authenticated, show the setup agent modal
    setActiveModal("setupAgent");
  };

  const onSubmit = () => {};

  return (
    <div className="relative left-1/2 right-1/2 ml-[-50vw] mr-[-50vw] w-screen bg-gray-900">
      <div className="2xl:px-45 flex w-full flex-col items-center justify-around gap-10 px-10 py-12 md:flex-row">
        <Card
          corner="bottom-left"
          cropSize={50}
          className="pb-15 relative flex h-[300px] w-[500px] flex-col justify-between bg-black px-10 pt-10"
        >
          <Image
            src="/default_agent_2.png"
            alt="agent"
            className="pointer-events-none absolute bottom-[-50px] right-[-80px] z-0 object-contain"
            width={350}
            height={350}
          />

          <h2 className="text-3xl font-semibold text-white">Add your agent</h2>
          <div className="flex flex-col justify-between">
            <span className="w-1/2 text-gray-400">
              Register your agent, win rewards
            </span>
            <Button
              onClick={handleAddAgent}
              className="mt-5 w-1/3 bg-white px-8 py-6 text-black hover:bg-gray-200"
            >
              ADD AGENT
            </Button>
          </div>
        </Card>
        <Card
          corner="bottom-left"
          cropSize={50}
          className="flex h-[300px] w-[500px] items-center justify-center bg-gray-600"
        >
          <Card
            corner="bottom-left"
            cropSize={50}
            className="pb-15 relative flex h-80 w-full flex-col justify-between bg-gray-900 px-10 pt-10"
          >
            <h2 className="text-3xl font-semibold text-white">
              Never miss a competition
            </h2>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
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
                            <Button className="bg-white px-8 text-black hover:bg-gray-200">
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
      </div>

      {/* Modals */}
      <ConnectWalletModal
        isOpen={activeModal === "connectWallet"}
        onClose={() => setActiveModal(null)}
      />
      <SetupAgentModal
        isOpen={activeModal === "setupAgent"}
        onClose={() => setActiveModal(null)}
        redirectTo={pathname}
      />
    </div>
  );
};
