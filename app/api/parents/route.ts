import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Parent } from "@/lib/types";

export async function GET() {
  try {
    const rows = await getSheetData("parents!A:J");
    const parents: Parent[] = rows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], playerName: r[1] ?? "", furigana: r[2] ?? "",
      jerseyNumber: r[3] ?? "", group: r[4] ?? "", carCapacity: Number(r[5] ?? 0),
      bucketOrder: Number(r[6] ?? 0), uniformNumber: r[7] ?? "",
      blueBibsNumber: r[8] ?? "", yellowBibsNumber: r[9] ?? "",
    }));
    return NextResponse.json(parents);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Parent, "id"> = await req.json();
    const id = crypto.randomUUID();
    await appendRow("parents", [id, body.playerName, body.furigana, body.jerseyNumber, body.group, body.carCapacity, body.bucketOrder ?? 0, body.uniformNumber ?? "", body.blueBibsNumber ?? "", body.yellowBibsNumber ?? ""]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
