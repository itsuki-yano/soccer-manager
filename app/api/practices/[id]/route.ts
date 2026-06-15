import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow } from "@/lib/sheets";
import type { Practice } from "@/lib/types";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body: Partial<Practice> = await req.json();
    const rows = await getSheetData("practices!A:G");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    const old = rows[idx];
    await updateRow("practices", idx + 1, [
      id,
      body.date ?? old[1],
      body.type ?? old[2],
      body.venue ?? old[3],
      body.startTime ?? old[4],
      body.endTime ?? old[5],
      body.bandUid ?? old[6] ?? "",
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const rows = await getSheetData("practices!A:G");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deleteRow("practices", idx + 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
