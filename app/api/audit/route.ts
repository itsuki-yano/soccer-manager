import { NextResponse } from "next/server";
import { getSheetData, ensureSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// 操作ログ一覧（新しい順・最大300件）
export async function GET() {
  try {
    let rows: string[][];
    try { rows = await getSheetData("audit_log!A:E"); }
    catch { await ensureSheets(); rows = await getSheetData("audit_log!A:E"); }
    const logs = rows.slice(1).filter((r) => r[0]).map((r) => ({
      time: r[0] ?? "", ip: r[1] ?? "", device: r[2] ?? "", method: r[3] ?? "", path: r[4] ?? "",
    }));
    logs.reverse();
    return NextResponse.json(logs.slice(0, 300));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
