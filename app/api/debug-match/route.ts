import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const rows = await getSheetData("matches!A:N");
  const idx = id ? rows.findIndex((r) => r[0] === id) : -1;
  return NextResponse.json({
    totalRows: rows.length,
    headerRow: rows[0],
    foundIdx: idx,
    foundRowNum: idx + 1,
    foundRow: idx >= 0 ? rows[idx] : null,
  });
}
