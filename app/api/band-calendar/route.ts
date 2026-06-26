import { NextResponse } from "next/server";

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  location: string;
  description: string;
  url: string;
}

// BAND投稿URL（https://band.us/band/.../post/...）を抽出
function extractPostUrl(e: Partial<ICalEvent>): string {
  const re = /https?:\/\/band\.us\/\S+/i;
  if (e.url && re.test(e.url)) return e.url.match(re)![0];
  if (e.description) { const m = e.description.match(re); if (m) return m[0]; }
  if (e.url) return e.url; // URLプロパティがband.us以外でも一応返す
  return "";
}

// 「日本、〒448-0011 愛知県…」→「愛知県…」（郵便番号より後だけ採用）
function cleanAddress(raw: string): string {
  const s = (raw ?? "").trim();
  const m = s.match(/〒?\s*\d{3}-?\d{4}\s*(.+)$/);
  if (m && m[1].trim()) return m[1].trim();
  return s.replace(/^日本[、,\s]*/, "").trim();
}

function shouldSkip(summary: string): boolean {
  return summary.includes("練習");
}

function detectMatchType(summary: string): string {
  if (/トレーニングマッチ|TM|トレマ/i.test(summary)) return "TM";
  if (/合宿/.test(summary)) return "合宿";
  return "公式戦";
}

function parseDtstart(value: string): string {
  const cleaned = value.replace(/[TZ]/g, "");
  const d = cleaned.slice(0, 8);
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

function parseIcal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // unfold continuation lines
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  let inEvent = false;
  let current: Partial<ICalEvent> = {};

  for (const line of unfolded) {
    if (line.trim() === "BEGIN:VEVENT") {
      inEvent = true;
      current = {};
    } else if (line.trim() === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.summary && current.dtstart) {
        events.push(current as ICalEvent);
      }
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const keyPart = line.slice(0, colonIdx).split(";")[0].toUpperCase();
      const value = line.slice(colonIdx + 1).trim();
      const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      if (keyPart === "UID") current.uid = value;
      else if (keyPart === "SUMMARY") current.summary = unescape(value);
      else if (keyPart === "LOCATION") current.location = unescape(value);
      else if (keyPart === "DTSTART") current.dtstart = parseDtstart(value);
      else if (keyPart === "DESCRIPTION") current.description = unescape(value);
      else if (keyPart === "URL") current.url = value;
    }
  }

  return events;
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
    const events = parseIcal(text);

    const filtered = events.filter((e) => !shouldSkip(e.summary));

    const results = await Promise.all(
      filtered.map(async (e) => {
        const matchType = detectMatchType(e.summary);
        let distanceKm = 0;
        const address = cleanAddress(e.location ?? "");
        const isHome = address.includes("かりがね") || e.summary.includes("かりがね");
        if (address && !isHome) {
          distanceKm = await calcDistance(address);
        }
        return {
          bandUid: e.uid,
          date: e.dtstart,
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
        };
      })
    );

    results.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
