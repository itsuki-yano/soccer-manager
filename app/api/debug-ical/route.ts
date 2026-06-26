import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 一時診断: iCalフィードの最初のVEVENTの生プロパティを確認
export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "no url" }, { status: 500 });
  try {
    const res = await fetch(icalUrl, { cache: "no-store" });
    const text = await res.text();
    const hasBandUs = text.includes("band.us");
    const hasUrlProp = /\nURL[:;]/i.test(text.replace(/\r/g, ""));
    // 最初のVEVENTのキー一覧
    const m = text.replace(/\r\n/g, "\n").match(/BEGIN:VEVENT([\s\S]*?)END:VEVENT/);
    const block = m ? m[1] : "";
    const keys = [...block.matchAll(/\n([A-Z-]+)[;:]/g)].map((x) => x[1]);
    // band.us を含む行を抽出（最大3件）
    const bandLines = text.split("\n").filter((l) => l.includes("band.us")).slice(0, 3);
    return NextResponse.json({ hasBandUs, hasUrlProp, firstEventKeys: [...new Set(keys)], bandLines });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
