import { NextResponse } from "next/server";
import { getSheetData, appendRow, ensureSheets } from "@/lib/sheets";
import type { Fee } from "@/lib/types";

function rowToFee(r: string[]): Fee {
  return {
    id: r[0] ?? "",
    name: r[1] ?? "",
    category: r[2] ?? "",
    amount: Number(r[3] ?? 0),
    date: r[4] ?? "",
    description: r[5] ?? "",
  };
}

export async function GET() {
  try {
    const rows = await getSheetData("fees!A:F");
    return NextResponse.json(rows.slice(1).filter((r) => r[0]).map(rowToFee));
  } catch (e) {
    if (String(e).includes("Unable to parse range")) {
      await ensureSheets();
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<Fee, "id"> = await req.json();
    const id = crypto.randomUUID();
    await appendRow("fees", [id, body.name, body.category, body.amount, body.date, body.description ?? ""]);
    return NextResponse.json({ id });
  } catch (e) {
    if (String(e).includes("Unable to parse range")) {
      await ensureSheets();
      const body: Omit<Fee, "id"> = await req.json();
      const id = crypto.randomUUID();
      await appendRow("fees", [id, body.name, body.category, body.amount, body.date, body.description ?? ""]);
      return NextResponse.json({ id });
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
