import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { Equipment } from "@/lib/types";

function rowToEquipment(r: string[]): Equipment {
  return {
    id: r[0] ?? "",
    name: r[1] ?? "",
    quantity: Number(r[2] ?? 1),
    memo: r[3] ?? "",
    parentId: r[4] ?? "",
    order: Number(r[5] ?? 0),
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("equipment!A:F");
    const items = rows.slice(1).filter((r) => r[0]).map(rowToEquipment);
    return NextResponse.json(items);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Equipment, "id"> = await req.json();
    const id = Date.now().toString();
    await appendRow("equipment", [id, body.name, body.quantity, body.memo, body.parentId, body.order]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
