import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Match } from "@/lib/types";

function rowToMatch(r: string[]): Match {
  return {
    id: r[0] ?? "",
    date: r[1] ?? "",
    matchName: r[2] ?? "",
    opponent: r[3] ?? "",
    venue: r[4] ?? "",
    address: r[5] ?? "",
    distanceKm: Number(r[6] ?? 0),
    carCount: Number(r[7] ?? 0),
    accountant: r[8] ?? "",
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("matches!A:I");
    const matches = rows.slice(1).filter((r) => r[0]).map(rowToMatch);
    return NextResponse.json(matches);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Match, "id"> = await req.json();
    const id = Date.now().toString();
    await appendRow("matches", [
      id, body.date, body.matchName, body.opponent,
      body.venue, body.address, body.distanceKm, body.carCount, body.accountant,
    ]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
