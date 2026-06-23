import { NextResponse } from "next/server";
import { getSheetData, appendRow } from "@/lib/sheets";
import type { CoachExpense } from "@/lib/types";

export async function GET() {
  try {
    const rows = await getSheetData("coach_expenses!A:G");
    const expenses: CoachExpense[] = rows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], date: r[1] ?? "", description: r[2] ?? "",
      amount: Number(r[3] ?? 0), claimed: r[4] ?? "",
      purchaserName: r[5] ?? "", receiptUrl: r[6] ?? "",
    }));
    return NextResponse.json(expenses);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Omit<CoachExpense, "id"> = await req.json();
    const id = crypto.randomUUID();
    await appendRow("coach_expenses", [id, body.date, body.description, body.amount, body.claimed ?? "", body.purchaserName ?? "", body.receiptUrl ?? ""]);
    return NextResponse.json({ id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
