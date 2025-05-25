import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

import { addAgent } from "@/data-mock/db";
import { agents } from "@/data-mock/fixtures";
import { Agent } from "@/types";
import { applyFilters, applySort, paginate } from "@/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  let rows = agents;
  rows = applyFilters(rows, filter);
  rows = applySort(rows, sort);
  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, agents: data });
}

export async function POST(req: NextRequest) {
  const agentData = await req.json();

  // Generate ID if not provided
  if (!agentData.id) {
    agentData.id = uuid();
  }

  const newAgent = addAgent(agentData as Agent);
  return NextResponse.json({ agent: newAgent }, { status: 201 });
}
