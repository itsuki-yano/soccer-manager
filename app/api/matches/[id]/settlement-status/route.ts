import { NextResponse } from "next/server";
import { getSheetData, getSheetsClient } from "@/lib/sheets";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { settlementStatus } = await req.json();
    const rows = await getSheetData("matches!A:N");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    const sheets = await getSheetsClient();
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
      range: `matches!N${idx + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[settlementStatus ?? ""]] },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
