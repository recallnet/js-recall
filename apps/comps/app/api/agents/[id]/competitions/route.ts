import { NextRequest, NextResponse } from "next/server";

import { findAgent, findCompetitionsByAgent } from "@/data-mock/db";
import { applyFilters, applySort, paginate } from "@/utils";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  const agent = findAgent(id);
  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let rows = findCompetitionsByAgent(id);
  rows = applyFilters(rows, filter);
  rows = applySort(rows, sort);
  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, competitions: data });
}
