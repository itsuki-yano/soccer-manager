import { NextResponse } from "next/server";
import {
  parseIcal, parseDate, parseTime, cleanAddress, extractPostUrl,
  expandRecurrence, buildBandUid, isPracticeSummary,
} from "@/lib/ical";

function detectPracticeType(summary: string): string {
  if (/自主練習/.test(summary)) return "自主練習";
  return "通常練習";
}

export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "BAND_ICAL_URL が設定されていません" }, { status: 500 });

  try {
    const res = await fetch(icalUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();
    const events = parseIcal(text).filter((e) => isPracticeSummary(e.summary));

    const results = events.flatMap((e) => {
      const startTime = parseTime(e.dtstart);
      const endTime = e.dtend ? parseTime(e.dtend) : "";
      const dates = expandRecurrence(parseDate(e.dtstart), e.rrule, e.exdates);
      const fullLocation = cleanAddress(e.location ?? "");
      const venue = fullLocation.split(/[,、\n]/)[0].trim();
      const type = detectPracticeType(e.summary);
      const postUrl = extractPostUrl(e);
      return dates.map((date) => ({
        bandUid: buildBandUid(e.uid, date, !!e.rrule),
        date,
        type,
        venue,
        startTime,
        endTime,
        bandUrl: postUrl, // BAND投稿URL
        address: fullLocation, // フル住所（同期で取り込む）
      }));
    });

    results.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
