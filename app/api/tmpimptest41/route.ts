import { NextResponse } from "next/server";
import { getSheetsClient } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const TITLE = "_tmp_imp_test";
const URL_TARGET = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";

export async function GET() {
  const sheets = await getSheetsClient();
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: TITLE } } }] },
    });
  } catch { /* 既存 */ }

  const stamp = Date.now();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TITLE}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[`=IMPORTHTML("${URL_TARGET}?t=${stamp}","table",2)`]] },
  });

  const tries: string[] = [];
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TITLE}!A1:J10`,
    });
    const v = (res.data.values as string[][]) || [];
    const first = String(v[0]?.[0] ?? "");
    tries.push(`${i + 1}: ${first.slice(0, 60)}`);
    if (first && !first.startsWith("#N/A") && !first.includes("Loading") && !first.includes("読み込")) {
      return NextResponse.json({ ok: true, tries, rows: v });
    }
    if (first.startsWith("#N/A") && i >= 3) {
      return NextResponse.json({ ok: false, tries, note: "IMPORTHTML failed (#N/A)" });
    }
  }
  return NextResponse.json({ ok: false, tries, note: "timeout" });
}
