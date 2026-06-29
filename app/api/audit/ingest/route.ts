import { NextResponse } from "next/server";
import { appendRow, ensureSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ミドルウェアから呼ばれ、操作ログを1行追記する
export async function POST(req: Request) {
  try {
    const { ip = "", ua = "", method = "", path = "" } = await req.json();
    const row = [new Date().toISOString(), ip, ua, method, path];
    try { await appendRow("audit_log", row); }
    catch { await ensureSheets(); await appendRow("audit_log", row); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
