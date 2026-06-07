import { NextResponse } from "next/server";
import { getSheetData, updateRow } from "@/lib/sheets";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { needsSettlement } = await req.json();

    // 行全体を読み込んで needsSettlement だけ差し替えて書き直す
    const rows = await getSheetData("matches!A:N");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found", id, rowCount: rows.length }, { status: 404 });

    const row = [...(rows[idx] ?? [])];
    // 列数が足りない場合は空文字で埋める (A〜N = 14列)
    while (row.length < 14) row.push("");
    row[9] = needsSettlement ? "true" : "false"; // J列 = needsSettlement

    await updateRow("matches", idx + 1, row);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
