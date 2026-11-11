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
    needsSettlement: r[9]?.toLowerCase() === "true" || r[9] === "1",
    bandUid: r[10] ?? "",
    equipmentBringIn: r[11] ?? "",
    equipmentBringOut: r[12] ?? "",
    settlementStatus: r[13] ?? "",
    skippedDrivers: r[14] ?? "",
    bandUrl1: r[15] ?? "",
    bandUrl2: r[16] ?? "",
    startTime: r[17] ?? "",
    endTime: r[18] ?? "",
    // 既存の行には列が無いので、空欄は「当番あり」(false) として扱う
    noDriverDuty: r[19]?.toLowerCase() === "true" || r[19] === "1",
    noEquipDuty: r[20]?.toLowerCase() === "true" || r[20] === "1",
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("matches!A:U");
    const matches = rows.slice(1).filter((r) => r[0]).map(rowToMatch);
    return NextResponse.json(matches);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Match, "id"> = await req.json();
    const id = crypto.randomUUID();

    // 直前の試合の持ち帰り人を今回の持ってくる人に自動セット
    let equipmentBringIn = body.equipmentBringIn ?? "";
    if (!equipmentBringIn) {
      const rows = await getSheetData("matches!A:U");
      const existing = rows.slice(1).filter((r) => r[0]).map(rowToMatch);
      const prev = existing
        .filter((m) => m.date < body.date && m.equipmentBringOut)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prev) equipmentBringIn = prev.equipmentBringOut;
    }

    // 配車当番なしなら台数は0、備品持帰りなしなら持帰りは空（PUTと同じ正規化）
    const noDriverDuty = !!body.noDriverDuty;
    const noEquipDuty = !!body.noEquipDuty;

    await appendRow("matches", [
      id, body.date, body.matchType ?? "公式戦", body.matchName, body.opponent,
      body.venue, body.address, body.distanceKm, noDriverDuty ? 0 : body.carCount,
      body.needsSettlement ? "true" : "false",
      body.bandUid ?? "", equipmentBringIn, noEquipDuty ? "" : (body.equipmentBringOut ?? ""),
      body.settlementStatus ?? "", body.skippedDrivers ?? "",
      body.bandUrl1 ?? "", body.bandUrl2 ?? "",
      body.startTime ?? "", body.endTime ?? "",
      noDriverDuty ? "true" : "false",
      noEquipDuty ? "true" : "false",
    ]);
    return NextResponse.json({ id, equipmentBringIn });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
