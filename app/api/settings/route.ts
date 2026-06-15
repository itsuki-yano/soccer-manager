import { NextResponse } from "next/server";
import { getSheetData, updateRow, appendRow } from "@/lib/sheets";
import type { Settings } from "@/lib/types";

export async function GET() {
  try {
    const rows = await getSheetData("settings!A:B");
    const map: Record<string, string> = {};
    rows.slice(1).forEach((r) => { if (r[0]) map[r[0]] = r[1] ?? ""; });
    const settings: Settings = {
      teamName: map.teamName ?? "トラヴェッソ 5年生",
      gasPricePerKm: Number(map.gasPricePerKm ?? 16),
      accountant: map.accountant ?? "",
      leagueName: map.leagueName ?? "西三河リーグ",
      logoUrl: map.logoUrl ?? "",
      bucketDutyStartDate: map.bucketDutyStartDate ?? "",
      bucketDutyEndDate: map.bucketDutyEndDate ?? "",
    };
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body: Partial<Settings> = await req.json();
    const rows = await getSheetData("settings!A:B");
    const keys = ["teamName", "gasPricePerKm", "accountant", "leagueName", "logoUrl", "bucketDutyStartDate", "bucketDutyEndDate"] as const;
    for (const key of keys) {
      if (body[key] === undefined) continue;
      const idx = rows.findIndex((r) => r[0] === key);
      if (idx >= 0) {
        await updateRow("settings", idx + 1, [key, String(body[key])]);
      } else {
        await appendRow("settings", [key, String(body[key])]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
