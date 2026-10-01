import { NextResponse } from "next/server";
import {
  parseIcal, parseDate, parseTime, cleanAddress, extractPostUrl,
  expandRecurrence, buildBandUid, isPracticeSummary, isCancelledSummary,
} from "@/lib/ical";

function detectMatchType(summary: string): string {
  if (/トレーニングマッチ|TM|トレマ/i.test(summary)) return "TM";
  if (/合宿/.test(summary)) return "合宿";
  return "公式戦";
}

async function calcDistance(address: string): Promise<number> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/distance?address=${encodeURIComponent(address)}`);
    const data = await res.json();
    return data.roundTripKm ?? 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) {
    return NextResponse.json({ error: "BAND_ICAL_URL が設定されていません" }, { status: 500 });
  }

  try {
    const res = await fetch(icalUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();
    const events = parseIcal(text)
      .filter((e) => !isPracticeSummary(e.summary) && !isCancelledSummary(e.summary));

    const results = (
      await Promise.all(
        events.map(async (e) => {
          const matchType = detectMatchType(e.summary);
          const address = cleanAddress(e.location ?? "");
          const isHome = address.includes("かりがね") || e.summary.includes("かりがね");
          // 距離は会場ごとに1回だけ計算する。繰り返し予定を日付ごとに展開してから
          // 計算すると、同じ会場に対して何十回も距離APIを叩くことになるため。
          const distanceKm = address && !isHome ? await calcDistance(address) : 0;

          const startTime = parseTime(e.dtstart);
          const endTime = e.dtend ? parseTime(e.dtend) : "";
          // 繰り返し登録された試合も1回ずつ取り込めるように展開する
          const dates = expandRecurrence(parseDate(e.dtstart), e.rrule, e.exdates);

          return dates.map((date) => ({
            bandUid: buildBandUid(e.uid, date, !!e.rrule),
            date,
            startTime,
            endTime,
            matchType,
            matchName: e.summary,
            opponent: "",
            venue: address.split(/[,、\n]/)[0].trim(),
            address,
            distanceKm,
            carCount: isHome ? 0 : 1,
            needsSettlement: matchType !== "TM",
            isHome,
            postUrl: extractPostUrl(e),
          }));
        })
      )
    ).flat();

    results.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
