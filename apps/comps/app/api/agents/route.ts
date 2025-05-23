import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { addAgent, store } from "@/data-mock/db";
import { CreateAgentRequest } from "@/types";
import { applyFilters, applySort, paginate } from "@/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  let rows = store.agents;
  rows = applyFilters(rows, filter);
  rows = applySort(rows, sort);
  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, agents: data });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("wallet_address")?.value;

  if (!userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const agentData = await req.json();

  const newAgent = addAgent(agentData as CreateAgentRequest, userId);
  return NextResponse.json(
    { agentId: newAgent.id, apiKey: newAgent.apiKey },
    { status: 201 },
  );
}
