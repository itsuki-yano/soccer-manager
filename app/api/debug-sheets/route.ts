import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// 一時クリーンアップ: matchesシートの列R以降（ゴミデータ）を消去
export async function GET() {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
  try {
    const sheets = await getSheetsClient();
    const cleared = await sheets.spreadsheets.values.clear({
      spreadsheetId: SPREADSHEET_ID,
      range: "matches!R1:AZ100000",
    });
    return NextResponse.json({ clearedRange: cleared.data.clearedRange ?? null });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
