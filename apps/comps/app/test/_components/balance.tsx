"use client";

import { useQuery } from "@tanstack/react-query";

import { tanstackClient } from "@/rpc/clients/tanstack-query";

export default function Balance() {
  const { data } = useQuery(tanstackClient.boost.balance.queryOptions());
  if (data) {
    return <div>Balance: {data.balance.toString()}</div>;
  }
  return <div>Loading...</div>;
}
