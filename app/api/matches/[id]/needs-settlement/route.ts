import { NextResponse } from "next/server";
import { getSheetData, getSheetsClient } from "@/lib/sheets";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { needsSettlement, carCount } = await req.json();
    const rows = await getSheetData("matches!A:A");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    const sheets = await getSheetsClient();
    const rowNum = idx + 1;

    // needsSettlement は J列 (列9, 1-indexed=10)
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
      range: `matches!J${rowNum}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[needsSettlement ? "true" : "false"]] },
    });

    // carCount も同時更新する場合 (I列 = 列8, 1-indexed=9)
    if (carCount !== undefined) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
        range: `matches!I${rowNum}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [[carCount]] },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
