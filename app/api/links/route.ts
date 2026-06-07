import { NextResponse } from "next/server";
import { getSheetData, appendRow, ensureSheets } from "@/lib/sheets";

export async function GET() {
  try {
    let rows: string[][];
    try { rows = await getSheetData("links!A:C"); }
    catch { await ensureSheets(); rows = await getSheetData("links!A:C"); }
    const links = rows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], name: r[1] ?? "", url: r[2] ?? "",
    }));
    return NextResponse.json(links);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, url } = await req.json();
    const id = crypto.randomUUID();
    try { await appendRow("links", [id, name, url]); }
    catch { await ensureSheets(); await appendRow("links", [id, name, url]); }
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
