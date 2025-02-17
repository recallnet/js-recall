"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAccount } from "wagmi";

import { ScrollArea, ScrollBar } from "@recallnet/ui/components/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recallnet/ui/components/tabs";

import { useHashmark } from "@/hooks/useHashmark";
import { usePrevious } from "@/hooks/usePrevious";

import { Account } from "./account";
import { ApprovalsFrom } from "./approvals-from";
import { ApprovalsTo } from "./approvals-to";

export function AccountTabs() {
  const { isConnected } = useAccount();
  const { prev: prevConnected, current: connected } = usePrevious(isConnected);

  const router = useRouter();

  const hash = useHashmark();

  const handleTabChange = (value: string) => {
    window.location.hash = value;
    router.push(`/account#${value}`);
  };

  useEffect(() => {
    if (prevConnected && !connected) {
      router.push("/");
    }
  }, [prevConnected, connected, router]);

  return (
    <Tabs value={hash.slice(1) || "account"} onValueChange={handleTabChange}>
      <ScrollArea>
        <TabsList>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="approvals-granted">Approvals Granted</TabsTrigger>
          <TabsTrigger value="approvals-received">
            Approvals Received
          </TabsTrigger>
        </TabsList>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <TabsContent value="account">
        <Account />
      </TabsContent>
      <TabsContent value="approvals-granted">
        <ApprovalsTo />
      </TabsContent>
      <TabsContent value="approvals-received">
        <ApprovalsFrom />
      </TabsContent>
    </Tabs>
  );
}
