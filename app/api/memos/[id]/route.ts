import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow } from "@/lib/sheets";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { content } = await req.json();
    const rows = await getSheetData("memos!A:D");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    const createdAt = rows[idx][2] ?? new Date().toISOString();
    const updatedAt = new Date().toISOString();
    await updateRow("memos", idx + 1, [id, content, createdAt, updatedAt]);
    return NextResponse.json({ ok: true, updatedAt });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await getSheetData("memos!A:D");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deleteRow("memos", idx + 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
