import { NextResponse } from "next/server";
import { getSheetData, appendRow, getSheetsClient } from "@/lib/sheets";
import type { Driver } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const matchId = searchParams.get("matchId");
    const rows = await getSheetData("drivers!A:B");
    let drivers: Driver[] = rows.slice(1).filter((r) => r[0]).map((r) => ({
      matchId: r[0], parentName: r[1] ?? "",
    }));
    if (matchId) drivers = drivers.filter((d) => d.matchId === matchId);
    return NextResponse.json(drivers);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: { matchId: string; parentNames: string[] } = await req.json();
    // 既存の当番を削除してから再登録
    const rows = await getSheetData("drivers!A:B");
    const toDelete = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r, i }) => i > 0 && r[0] === body.matchId)
      .map(({ i }) => i + 1)
      .sort((a, b) => b - a);

    const sheets = await getSheetsClient();
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    });
    const sheetObj = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === "drivers"
    );
    if (sheetObj?.properties?.sheetId !== undefined && toDelete.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
        requestBody: {
          requests: toDelete.map((rowIdx) => ({
            deleteDimension: {
              range: {
                sheetId: sheetObj.properties!.sheetId,
                dimension: "ROWS",
                startIndex: rowIdx - 1,
                endIndex: rowIdx,
              },
            },
          })),
        },
      });
    }

    for (const name of body.parentNames) {
      if (name.trim()) await appendRow("drivers", [body.matchId, name.trim()]);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
