import { NextRequest, NextResponse } from "next/server";

import { findAgentsByCompetition } from "@/data-mock/db";
import { applySort, paginate } from "@/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter")?.toLowerCase() ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  let rows = findAgentsByCompetition(id);

  if (filter) {
    rows = rows.filter(
      (agent) =>
        agent.name?.toLowerCase().startsWith(filter) ||
        agent.id?.toLowerCase().startsWith(filter) ||
        agent.metadata?.walletAddress?.toLowerCase().startsWith(filter),
    );
  }

  rows = applySort(rows, sort);
  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, agents: data });
}
