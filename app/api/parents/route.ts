import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Parent } from "@/lib/types";

export async function GET() {
  try {
    const rows = await getSheetData("parents!A:C");
    const parents: Parent[] = rows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], parentName: r[1] ?? "", playerName: r[2] ?? "",
    }));
    return NextResponse.json(parents);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Parent, "id"> = await req.json();
    const id = Date.now().toString();
    await appendRow("parents", [id, body.parentName, body.playerName]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
