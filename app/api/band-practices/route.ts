import { NextResponse } from "next/server";

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location: string;
  rrule?: string;
  exdates?: string[];
  url?: string;
  description?: string;
}

// BAND投稿URL（https://band.us/band/.../post/...）を抽出
function extractPostUrl(e: ICalEvent): string {
  const re = /https?:\/\/band\.us\/\S+/i;
  if (e.url && re.test(e.url)) return e.url.match(re)![0];
  if (e.description) { const m = e.description.match(re); if (m) return m[0]; }
  if (e.url) return e.url;
  return "";
}

// 「日本、〒448-0011 愛知県…」→「愛知県…」（郵便番号より後だけ採用）
function cleanAddress(raw: string): string {
  const s = (raw ?? "").trim();
  const m = s.match(/〒?\s*\d{3}-?\d{4}\s*(.+)$/);
  if (m && m[1].trim()) return m[1].trim();
  return s.replace(/^日本[、,\s]*/, "").trim();
}

function isPractice(summary: string): boolean {
  return /通常練習|自主練習|練習/.test(summary);
}

function detectPracticeType(summary: string): string {
  if (/自主練習/.test(summary)) return "自主練習";
  return "通常練習";
}

function parseDtstart(value: string): { date: string; time: string } {
  const cleaned = value.replace(/[TZ]/g, "");
  const d = cleaned.slice(0, 8);
  const t = cleaned.slice(8, 12);
  const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  const time = t.length >= 4 ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : "";
  return { date, time };
}

function parseIcal(text: string): ICalEvent[] {
  const events: ICalEvent[] = [];
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
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
    if (line.trim() === "BEGIN:VEVENT") { inEvent = true; current = {}; }
    else if (line.trim() === "END:VEVENT") {
      inEvent = false;
      if (current.uid && current.summary && current.dtstart) events.push(current as ICalEvent);
    } else if (inEvent) {
      const colonIdx = line.indexOf(":");
      if (colonIdx < 0) continue;
      const key = line.slice(0, colonIdx).split(";")[0].toUpperCase();
      const val = line.slice(colonIdx + 1).trim();
      const unescape = (s: string) => s.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
      if (key === "UID") current.uid = val;
      else if (key === "SUMMARY") current.summary = unescape(val);
      else if (key === "LOCATION") current.location = unescape(val);
      else if (key === "DTSTART") current.dtstart = val;
      else if (key === "DTEND") current.dtend = val;
      else if (key === "URL") current.url = val;
      else if (key === "DESCRIPTION") current.description = unescape(val);
      else if (key === "RRULE") current.rrule = val;
      else if (key === "EXDATE") {
        // 複数日付（カンマ区切り）に対応し YYYY-MM-DD で蓄積
        const dates = val.split(",").map((v) => {
          const c = v.replace(/[TZ]/g, "").slice(0, 8);
          return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`;
        });
        current.exdates = [...(current.exdates ?? []), ...dates];
      }
    }
  }
  return events;
}

const WEEKDAY_MAP: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// RRULE を展開して開催日(YYYY-MM-DD)の配列を返す。FREQ=WEEKLY/DAILY/MONTHLY に対応。
function expandRecurrence(startDate: string, rrule: string | undefined, exdates: string[] | undefined): string[] {
  if (!rrule) return [startDate];

  const rules: Record<string, string> = {};
  rrule.split(";").forEach((part) => {
    const [k, v] = part.split("=");
    if (k && v) rules[k.toUpperCase()] = v;
  });

  const freq = rules.FREQ;
  const interval = Math.max(1, parseInt(rules.INTERVAL ?? "1", 10) || 1);
  const count = rules.COUNT ? parseInt(rules.COUNT, 10) : undefined;
  const until = rules.UNTIL
    ? (() => { const c = rules.UNTIL.replace(/[TZ]/g, "").slice(0, 8); return `${c.slice(0, 4)}-${c.slice(4, 6)}-${c.slice(6, 8)}`; })()
    : undefined;
  const byday = rules.BYDAY ? rules.BYDAY.split(",").map((d) => WEEKDAY_MAP[d.trim().slice(-2)]).filter((n) => n !== undefined) : [];

  const start = new Date(startDate + "T00:00:00");
  // 終了境界: UNTIL があればそれ、なければ開始から1年後を上限
  const horizon = new Date(start);
  horizon.setFullYear(horizon.getFullYear() + 1);
  const exSet = new Set(exdates ?? []);
  const out: string[] = [];
  const limit = 366;

  const pushDate = (d: Date) => {
    const s = ymd(d);
    if (until && s > until) return false;
    if (d > horizon) return false;
    if (!exSet.has(s)) out.push(s);
    return true;
  };

  if (freq === "WEEKLY") {
    const days = (byday.length > 0 ? byday : [start.getDay()]).sort((a, b) => a - b);
    // 開始週の日曜日を基準に interval 週ごとに進める
    const weekStart = new Date(start);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    for (let w = 0; w < limit; w++) {
      const base = new Date(weekStart);
      base.setDate(base.getDate() + w * interval * 7);
      if (base > horizon) break;
      let stop = false;
      for (const wd of days) {
        const d = new Date(base);
        d.setDate(d.getDate() + wd);
        if (d < start || d > horizon) continue;
        const s = ymd(d);
        if (until && s > until) { stop = true; break; }
        if (!exSet.has(s)) out.push(s);
        if (count && out.length >= count) { stop = true; break; }
      }
      if (stop) break;
    }
  } else if (freq === "DAILY") {
    const d = new Date(start);
    for (let i = 0; out.length < limit; i++) {
      if (!pushDate(d)) break;
      if (count && out.length >= count) break;
      d.setDate(d.getDate() + interval);
    }
  } else if (freq === "MONTHLY") {
    const d = new Date(start);
    for (let i = 0; out.length < limit; i++) {
      if (!pushDate(d)) break;
      if (count && out.length >= count) break;
      d.setMonth(d.getMonth() + interval);
    }
  } else {
    return [startDate];
  }

  return [...new Set(out)].sort();
}

export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "BAND_ICAL_URL が設定されていません" }, { status: 500 });

  try {
    const res = await fetch(icalUrl, { cache: "no-store" });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();
    const events = parseIcal(text).filter((e) => isPractice(e.summary));

    const results = events.flatMap((e) => {
      const { date: firstDate, time: startTime } = parseDtstart(e.dtstart);
      const { time: endTime } = e.dtend ? parseDtstart(e.dtend) : { time: "" };
      const dates = expandRecurrence(firstDate, e.rrule, e.exdates);
      const fullLocation = cleanAddress(e.location ?? "");
      const venue = fullLocation.split(/[,、\n]/)[0].trim();
      const type = detectPracticeType(e.summary);
      const postUrl = extractPostUrl(e);
      return dates.map((date) => ({
        // 繰り返し予定は日付ごとに一意なUIDにする（単発はそのまま）
        bandUid: e.rrule ? `${e.uid}_${date}` : e.uid,
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
