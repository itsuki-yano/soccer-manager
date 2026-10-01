import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// 調査用の一時エンドポイント。BANDのiCalにどんな繰り返し予定があるかを俯瞰する。
export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "no url" }, { status: 500 });
  const res = await fetch(icalUrl, { cache: "no-store" });
  const text = await res.text();

  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] += line.slice(1);
    } else unfolded.push(line);
  }

  const out: Record<string, string>[] = [];
  let cur: Record<string, string> | null = null;
  for (const line of unfolded) {
    if (line.trim() === "BEGIN:VEVENT") cur = {};
    else if (line.trim() === "END:VEVENT") { if (cur) out.push(cur); cur = null; }
    else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const key = line.slice(0, i).split(";")[0].toUpperCase();
      const val = line.slice(i + 1).trim();
      if (["SUMMARY", "DTSTART", "RRULE", "UID"].includes(key)) cur[key] = val;
      if (key === "EXDATE") cur.EXDATE = (cur.EXDATE ? cur.EXDATE + " | " : "") + val;
    }
  }

  const isPractice = (s: string) => /練習/.test(s ?? "");
  const summarize = (e: Record<string, string>) => ({
    summary: e.SUMMARY ?? "",
    dtstart: e.DTSTART ?? "",
    rrule: e.RRULE ?? "",
    exdate: e.EXDATE ?? "",
    kind: isPractice(e.SUMMARY ?? "") ? "練習→band-practices" : "試合→band-calendar",
  });

  const all = out.map(summarize);
  return NextResponse.json({
    total: all.length,
    recurring: all.filter((e) => e.rrule).length,
    matchesWithRrule: all.filter((e) => e.rrule && e.kind.startsWith("試合")),
    practicesWithRrule: all.filter((e) => e.rrule && e.kind.startsWith("練習")),
    nonRecurring: all.filter((e) => !e.rrule),
  });
}
