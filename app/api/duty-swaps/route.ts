import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { DutySwap } from "@/lib/types";

function rowToSwap(r: string[]): DutySwap {
  return { id: r[0] ?? "", personA: r[1] ?? "", personB: r[2] ?? "" };
}

export async function GET() {
  try {
    const rows = await getSheetData("duty_swaps!A:C");
    return NextResponse.json(rows.slice(1).filter((r) => r[0]).map(rowToSwap));
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { personA, personB }: { personA: string; personB: string } = await req.json();
    const id = crypto.randomUUID();
    await appendRow("duty_swaps", [id, personA, personB]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
