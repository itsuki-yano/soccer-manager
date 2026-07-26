import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const icalUrl = process.env.BAND_ICAL_URL;
  if (!icalUrl) return NextResponse.json({ error: "no url" }, { status: 500 });
  const res = await fetch(icalUrl, { cache: "no-store" });
  const text = await res.text();
  const blocks = text.replace(/\r\n/g, "\n").split("BEGIN:VEVENT").slice(1);
  const targets = ["1004959579", "1004960276", "1004960587", "1004960632", "999924992"];
  const matched = blocks
    .filter((b) => targets.some((t) => b.includes(t)))
    .map((b) => "BEGIN:VEVENT" + b.split("END:VEVENT")[0] + "END:VEVENT");
  return new NextResponse(matched.join("\n---\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
