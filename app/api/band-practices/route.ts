import { NextResponse } from "next/server";
import {
  parseIcal, parseDate, parseTime, cleanAddress, extractPostUrl,
  expandRecurrence, buildBandUid, isPracticeSummary,
} from "@/lib/ical";

function detectPracticeType(summary: string): string {
  if (/自主練習/.test(summary)) return "自主練習";
  return "通常練習";
}

// 通常練習はBAND側に場所が入っておらず、代わりにタイトルへ
// 「かりがね小」「平成小」と学校名が入っている。会場名と住所をここで補う。
// 住所はアプリに登録済みの過去データから確認したもの。
const SCHOOLS: { pattern: RegExp; venue: string; address: string }[] = [
  { pattern: /かりがね小/, venue: "刈谷市立かりがね小学校", address: "愛知県刈谷市築地町２丁目１５−１" },
  { pattern: /平成小/, venue: "刈谷市立平成小学校", address: "愛知県刈谷市一ツ木町３丁目１８−１" },
];

function schoolFromSummary(summary: string) {
  return SCHOOLS.find((s) => s.pattern.test(summary ?? "")) ?? null;
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
      // タイトルから学校を判別できたら会場名に使う。住所はBAND側にあればそれを優先し、
      // 無ければ学校の住所で補う。
      const school = schoolFromSummary(e.summary);
      const venue = school ? school.venue : fullLocation.split(/[,、\n]/)[0].trim();
      const address = fullLocation || school?.address || "";
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
        address, // フル住所（BAND側に無ければ学校の住所で補完）
      }));
    });

    results.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
