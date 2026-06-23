import { NextResponse } from "next/server";
import { getSheetData, appendRow, updateRow, ensureSheets } from "@/lib/sheets";

export async function GET() {
  try {
    let rows: string[][];
    try { rows = await getSheetData("links!A:D"); }
    catch { await ensureSheets(); rows = await getSheetData("links!A:D"); }
    const links = rows.slice(1).filter((r) => r[0]).map((r, i) => ({
      id: r[0], name: r[1] ?? "", url: r[2] ?? "",
      order: r[3] !== undefined && r[3] !== "" ? Number(r[3]) : i,
    }));
    links.sort((a, b) => a.order - b.order);
    return NextResponse.json(links);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, url } = await req.json();
    const id = crypto.randomUUID();
    // 末尾に追加するため現在の件数を order に使う
    let order = 0;
    try {
      const rows = await getSheetData("links!A:D");
      order = rows.slice(1).filter((r) => r[0]).length;
    } catch { /* シート未作成時は0 */ }
    try { await appendRow("links", [id, name, url, String(order)]); }
    catch { await ensureSheets(); await appendRow("links", [id, name, url, String(order)]); }
    return NextResponse.json({ id, order });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 並び順の一括更新（orderedIds の順に order を振り直す）
export async function PATCH(req: Request) {
  try {
    const { orderedIds }: { orderedIds: string[] } = await req.json();
    const rows = await getSheetData("links!A:D");
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      const idx = rows.findIndex((r) => r[0] === id);
      if (idx < 1) continue; // ヘッダー(0)や未検出はスキップ
      const r = rows[idx];
      await updateRow("links", idx + 1, [r[0], r[1] ?? "", r[2] ?? "", String(i)]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
