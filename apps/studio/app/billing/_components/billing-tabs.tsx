"use client";

import { useEffect, useState } from "react";

import { ScrollArea, ScrollBar } from "@recall/ui/components/scroll-area";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@recall/ui/components/tabs";

import { Account } from "./account";
import { ApprovalsFrom } from "./approvals-from";
import { ApprovalsTo } from "./approvals-to";

const useHash = () => {
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
    const onHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
};

export function BillingTabs() {
  const hash = useHash();

  const handleTabChange = (value: string) => {
    window.location.hash = value;
  };

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
