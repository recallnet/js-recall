import { NextRequest, NextResponse } from "next/server";

import { store } from "@/data-mock/db";
import { applyFilters, applySort, paginate } from "@/utils";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? undefined;
  const sort = searchParams.get("sort") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  let rows = store.competitions;
  rows = applyFilters(rows, filter);
  rows = applySort(rows, sort);
  const { metadata, data } = paginate(rows, limit, offset);

  return NextResponse.json({ metadata, competitions: data });
}
