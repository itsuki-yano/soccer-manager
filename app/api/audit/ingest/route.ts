import { NextResponse } from "next/server";
import { appendRow, ensureSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// ミドルウェアから呼ばれ、操作ログを1行追記する
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // ミドルウェア経由は body.ip/ua、クライアント直叩きはリクエストヘッダーから取得
    const ip = body.ip || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "";
    const ua = body.ua || req.headers.get("user-agent") || "";
    const row = [new Date().toISOString(), ip, ua, body.method || "", body.path || "", body.detail || ""];
    try { await appendRow("audit_log", row); }
    catch { await ensureSheets(); await appendRow("audit_log", row); }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
