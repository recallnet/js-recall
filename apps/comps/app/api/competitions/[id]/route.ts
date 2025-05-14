import { NextRequest, NextResponse } from "next/server";

import {
  deleteCompetition,
  findCompetition,
  updateCompetition,
} from "@/data-mock/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const competition = findCompetition(id);

  if (!competition) {
    return NextResponse.json(
      { error: "Competition not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(competition);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const updates = await req.json();

  const updated = updateCompetition(id, updates);

  if (!updated) {
    return NextResponse.json(
      { error: "Competition not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ competition: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const success = deleteCompetition(id);

  if (!success) {
    return NextResponse.json(
      { error: "Competition not found" },
      { status: 404 },
    );
  }

  return NextResponse.json({ success: true });
}
