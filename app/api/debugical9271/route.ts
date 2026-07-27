import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const URL_TARGET = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

export async function GET() {
  const attempts: Record<string, string>[] = [
    { label: "current-ua", "User-Agent": "Mozilla/5.0 (compatible; SoccerManager/1.0)" },
    { label: "no-headers" },
    { label: "browser-headers", ...BROWSER_HEADERS },
  ];

  const out = [];
  for (const a of attempts) {
    const { label, ...headers } = a;
    try {
      const res = await fetch(URL_TARGET, { headers, cache: "no-store" });
      const body = await res.text();
      out.push({
        label,
        status: res.status,
        server: res.headers.get("server"),
        cfRay: res.headers.get("cf-ray"),
        cfMitigated: res.headers.get("cf-mitigated"),
        length: body.length,
        snippet: body.slice(0, 400),
      });
    } catch (e) {
      out.push({ label, error: String(e) });
    }
  }
  return NextResponse.json(out);
}
