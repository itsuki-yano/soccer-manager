import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Match } from "@/lib/types";

function rowToMatch(r: string[]): Match {
  return {
    id: r[0] ?? "",
    date: r[1] ?? "",
    matchType: r[2] ?? "公式戦",
    matchName: r[3] ?? "",
    opponent: r[4] ?? "",
    venue: r[5] ?? "",
    address: r[6] ?? "",
    distanceKm: Number(r[7] ?? 0),
    carCount: Number(r[8] ?? 0),
    needsSettlement: r[9] === "true" || r[9] === "1",
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("matches!A:J");
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
      id, body.date, body.matchType ?? "公式戦", body.matchName, body.opponent,
      body.venue, body.address, body.distanceKm, body.carCount,
      body.needsSettlement ? "true" : "false",
    ]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
