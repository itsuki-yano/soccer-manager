import { NextResponse } from "next/server";

interface ICalEvent {
  uid: string;
  summary: string;
  dtstart: string;
  dtend: string;
  location: string;
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
    }
  }
  return events;
}

export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "BAND_ICAL_URL が設定されていません" }, { status: 500 });

  try {
    const res = await fetch(icalUrl, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
    const text = await res.text();
    const events = parseIcal(text).filter((e) => isPractice(e.summary));

    const results = events.map((e) => {
      const { date, time: startTime } = parseDtstart(e.dtstart);
      const { time: endTime } = e.dtend ? parseDtstart(e.dtend) : { time: "" };
      return {
        bandUid: e.uid,
        date,
        type: detectPracticeType(e.summary),
        venue: (e.location ?? "").split(/[,、\n]/)[0].trim(),
        startTime,
        endTime,
      };
    });

    results.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json(results);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
