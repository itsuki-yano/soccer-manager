import { NextResponse } from "next/server";
import { getSheetsClient, getSheetData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// 一時診断用: matchesシートへ追記→即読み直しして永続化を検証
export async function GET() {
  const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
  try {
    const before = (await getSheetData("matches!A:A")).length;
    const sheets = await getSheetsClient();
    const appendRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "matches!A:Z",
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [["__DEBUG__", "2099-12-31", "TM", "DEBUG", "", "", "", 0, 0, "false", "", "", "", "", "", "", ""]] },
    });
    const after = (await getSheetData("matches!A:A")).length;
    return NextResponse.json({
      spreadsheetIdTail: SPREADSHEET_ID?.slice(-6),
      before,
      after,
      updatedRange: appendRes.data.updates?.updatedRange ?? null,
      updatedRows: appendRes.data.updates?.updatedRows ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
