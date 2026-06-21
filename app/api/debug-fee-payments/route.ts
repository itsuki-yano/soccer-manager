import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET() {
  const rows = await getSheetData("fee_payments!A:D");
  return NextResponse.json({ rowCount: rows.length, rows: rows.slice(0, 10) });
}
