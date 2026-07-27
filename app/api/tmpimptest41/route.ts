import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const TITLE = "_tmp_imp_test";

// 検証用に作成した一時シートを削除するための後始末エンドポイント
export async function GET() {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const target = meta.data.sheets?.find((s) => s.properties?.title === TITLE);
  if (!target?.properties?.sheetId) return NextResponse.json({ ok: true, note: "already removed" });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests: [{ deleteSheet: { sheetId: target.properties.sheetId } }] },
  });
  return NextResponse.json({ ok: true, deleted: TITLE });
}
