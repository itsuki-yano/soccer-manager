import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow, getSheetsClient } from "@/lib/sheets";
import type { Match } from "@/lib/types";

// その試合の配車当番の行をすべて消す。
// 「配車当番なし」にしたとき古い当番が残っていると、当番一覧のローテーションの
// 起点（直近で配車当番が入っている試合）になってしまうため確実に消しておく。
async function clearDrivers(matchId: string): Promise<void> {
  const rows = await getSheetData("drivers!A:B");
  const targets = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => i > 0 && r[0] === matchId)
    .map(({ i }) => i)
    .sort((a, b) => b - a); // 下から消して行番号がずれないようにする
  if (targets.length === 0) return;

  const sheets = await getSheetsClient();
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID! });
  const sheetObj = spreadsheet.data.sheets?.find((x) => x.properties?.title === "drivers");
  const sheetId = sheetObj?.properties?.sheetId;
  if (sheetId === undefined || sheetId === null) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    requestBody: {
      requests: targets.map((rowIdx) => ({
        deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: rowIdx, endIndex: rowIdx + 1 } },
      })),
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: Omit<Match, "id"> = await req.json();
    const rows = await getSheetData("matches!A:U");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    // 当番を「なし」にしたら、割当の残骸も一緒に片付ける。
    // 残しておくと当番一覧やExcel出力（台数×距離）に出てきてしまう。
    const noDriverDuty = !!body.noDriverDuty;
    const noEquipDuty = !!body.noEquipDuty;
    const carCount = noDriverDuty ? 0 : body.carCount;
    const equipmentBringOut = noEquipDuty ? "" : (body.equipmentBringOut ?? "");
    if (noDriverDuty) await clearDrivers(id);

    await updateRow("matches", idx + 1, [
      id, body.date, body.matchType ?? "公式戦", body.matchName, body.opponent,
      body.venue, body.address, body.distanceKm, carCount,
      body.needsSettlement ? "true" : "false",
      body.bandUid ?? "", body.equipmentBringIn ?? "", equipmentBringOut,
      body.settlementStatus ?? "", body.skippedDrivers ?? "",
      body.bandUrl1 ?? "", body.bandUrl2 ?? "",
      body.startTime ?? "", body.endTime ?? "",
      noDriverDuty ? "true" : "false",
      noEquipDuty ? "true" : "false",
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await getSheetData("matches!A:N");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await deleteRow("matches", idx + 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
