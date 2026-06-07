import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow } from "@/lib/sheets";
import type { Match } from "@/lib/types";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: Omit<Match, "id"> = await req.json();
    const rows = await getSheetData("matches!A:J");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await updateRow("matches", idx + 1, [
      id, body.date, body.matchType ?? "公式戦", body.matchName, body.opponent,
      body.venue, body.address, body.distanceKm, body.carCount, body.accountant,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await getSheetData("matches!A:J");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deleteRow("matches", idx + 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
