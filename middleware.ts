import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 閲覧専用デプロイ（VIEW_ONLY=true）では API への書込み（GET以外）を一律ブロック
export function middleware(req: NextRequest) {
  if (
    process.env.VIEW_ONLY === "true" &&
    req.nextUrl.pathname.startsWith("/api") &&
    req.method !== "GET"
  ) {
    return NextResponse.json({ error: "閲覧専用モードです" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
