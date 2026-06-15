import { NextResponse } from "next/server";
import { getSheetData, appendRow, updateRow } from "@/lib/sheets";
import type { BucketDuty } from "@/lib/types";

function rowToDuty(r: string[]): BucketDuty {
  return {
    id: r[0] ?? "",
    practiceId: r[1] ?? "",
    bringPersonName: r[2] ?? "",
    returnPersonName: r[3] ?? "",
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const practiceId = searchParams.get("practiceId");
    const rows = await getSheetData("bucket_duties!A:D");
    let duties = rows.slice(1).filter((r) => r[0]).map(rowToDuty);
    if (practiceId) duties = duties.filter((d) => d.practiceId === practiceId);
    return NextResponse.json(duties);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: Partial<BucketDuty> & { practiceId: string } = await req.json();
    const rows = await getSheetData("bucket_duties!A:D");
    const existing = rows.slice(1).findIndex((r) => r[1] === body.practiceId);

    if (existing >= 0) {
      // 既存レコードを更新
      await updateRow("bucket_duties", existing + 2, [
        rows[existing + 1][0],
        body.practiceId,
        body.bringPersonName ?? "",
        body.returnPersonName ?? "",
      ]);
      return NextResponse.json({ id: rows[existing + 1][0] });
    } else {
      const id = crypto.randomUUID();
      await appendRow("bucket_duties", [
        id, body.practiceId, body.bringPersonName ?? "", body.returnPersonName ?? "",
      ]);
      return NextResponse.json({ id });
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
