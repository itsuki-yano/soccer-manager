import { NextResponse } from "next/server";
import { getSheetData, getSheetsClient, ensureSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

// 当番一覧に紐付けた自主練習ID一覧を返す
export async function GET() {
  try {
    let rows: string[][];
    try { rows = await getSheetData("duty_bucket_links!A:A"); }
    catch { await ensureSheets(); rows = await getSheetData("duty_bucket_links!A:A"); }
    const ids = rows.slice(1).map((r) => r[0]).filter(Boolean);
    return NextResponse.json(ids);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 紐付けた自主練習ID一覧を丸ごと置き換える
export async function PUT(req: Request) {
  try {
    const { practiceIds }: { practiceIds: string[] } = await req.json();
    const sheets = await getSheetsClient();
    try { await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "duty_bucket_links!A2:A100000" }); }
    catch { await ensureSheets(); await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: "duty_bucket_links!A2:A100000" }); }
    if (practiceIds.length > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `duty_bucket_links!A2:A${practiceIds.length + 1}`,
        valueInputOption: "RAW",
        requestBody: { values: practiceIds.map((id) => [id]) },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
