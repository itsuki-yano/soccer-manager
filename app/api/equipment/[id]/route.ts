import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow } from "@/lib/sheets";
import type { Equipment } from "@/lib/types";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: Omit<Equipment, "id"> = await req.json();
    const rows = await getSheetData("equipment!A:F");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await updateRow("equipment", idx + 1, [id, body.name, body.quantity, body.memo, body.parentId, body.order]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await getSheetData("equipment!A:F");
    // 子アイテムも含めて削除対象のIDを収集
    const toDelete: number[] = [];
    const childIds = rows.slice(1).filter((r) => r[4] === id).map((r) => r[0]);
    for (let i = rows.length - 1; i >= 1; i--) {
      if (rows[i][0] === id || childIds.includes(rows[i][0])) {
        toDelete.push(i + 1);
      }
    }
    // 後ろから削除（行番号がずれないように）
    for (const rowNum of toDelete.sort((a, b) => b - a)) {
      await deleteRow("equipment", rowNum);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
