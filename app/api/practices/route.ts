import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Practice } from "@/lib/types";

function rowToPractice(r: string[]): Practice {
  return {
    id: r[0] ?? "",
    date: r[1] ?? "",
    type: r[2] ?? "通常練習",
    venue: r[3] ?? "",
    startTime: r[4] ?? "",
    endTime: r[5] ?? "",
    bandUid: r[6] ?? "",
    address: r[7] ?? "",
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("practices!A:H");
    const practices = rows.slice(1).filter((r) => r[0]).map(rowToPractice);
    return NextResponse.json(practices);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Practice, "id"> = await req.json();
    const id = crypto.randomUUID();
    await appendRow("practices", [
      id, body.date, body.type, body.venue,
      body.startTime, body.endTime, body.bandUid ?? "", body.address ?? "",
    ]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
