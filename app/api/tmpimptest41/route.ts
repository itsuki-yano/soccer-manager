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

  // 前回のスピル結果を消してから書く（残っていると #REF! になる）
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: `${TITLE}!A1:Z200` });

  const stamp = Date.now();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${TITLE}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [[`=IMPORTHTML("${URL_TARGET}?t=${stamp}","table",2)`]] },
  });

  // エラーの詳細メッセージを取得
  await new Promise((r) => setTimeout(r, 4000));
  const detail = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [`${TITLE}!A1:B2`],
    includeGridData: true,
  });
  const cell = detail.data.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0];
  const errMsg = cell?.effectiveValue?.errorValue?.message ?? null;
  const errType = cell?.effectiveValue?.errorValue?.type ?? null;
  const gridProps = detail.data.sheets?.[0]?.properties?.gridProperties ?? null;

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
    const isError = first.startsWith("#");
    const isLoading = !first || first.includes("Loading") || first.includes("読み込");
    if (!isError && !isLoading) return NextResponse.json({ ok: true, tries, errMsg, errType, gridProps, rows: v });
    if (isError && !first.startsWith("#N/A") ) return NextResponse.json({ ok: false, tries, errMsg, errType, gridProps, note: `error: ${first}` });
    if (first.startsWith("#N/A") && i >= 4) return NextResponse.json({ ok: false, tries, errMsg, errType, gridProps, note: "IMPORTHTML failed (#N/A)" });
  }
  return NextResponse.json({ ok: false, tries, errMsg, errType, gridProps, note: "timeout" });
}
