import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 閲覧専用デプロイ（VIEW_ONLY=true）では API への書込み（GET以外）を一律ブロック
// それ以外では書込み操作を監査ログに記録（時刻・IP・デバイス・操作）
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isApi = path.startsWith("/api");
  const isMutation = req.method !== "GET";
  const isAudit = path.startsWith("/api/audit");

  if (process.env.VIEW_ONLY === "true" && isApi && isMutation && !isAudit) {
    return NextResponse.json({ error: "閲覧専用モードです" }, { status: 403 });
  }

  if (isApi && isMutation && !isAudit && process.env.VIEW_ONLY !== "true") {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    const ua = req.headers.get("user-agent") || "";
    try {
      await fetch(`${req.nextUrl.origin}/api/audit/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip, ua, method: req.method, path }),
      });
    } catch { /* ログ失敗は本処理に影響させない */ }
  }

  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
