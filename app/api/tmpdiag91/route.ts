import { NextResponse } from "next/server";
import { parseIcal, isPracticeSummary } from "@/lib/ical";

export const dynamic = "force-dynamic";

// 調査用の一時エンドポイント。BANDの全予定のタイトルと振り分け結果を確認する。
export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "no url" }, { status: 500 });
  const res = await fetch(icalUrl, { cache: "no-store" });
  const text = await res.text();
  const events = parseIcal(text);
  return NextResponse.json(
    events.map((e) => ({
      summary: e.summary,
      dtstart: e.dtstart,
      rrule: e.rrule ?? "",
      location: e.location ?? "",
      goesTo: isPracticeSummary(e.summary) ? "練習" : "試合",
    }))
  );
}
