import { NextResponse } from "next/server";
import { getSheetData, ensureSheets, appendRow, updateRow, deleteRow } from "@/lib/sheets";

export const dynamic = "force-dynamic";

// バケツ当番を「今回だけお休み」にする人。練習ごとに保持する。
// その練習が過ぎれば対象から外れるため、自然に元のローテーションへ戻る。
export type BucketSkip = { practiceId: string; names: string[] };

async function readRows(): Promise<string[][]> {
  try { return await getSheetData("bucket_skips!A:B"); }
  catch { await ensureSheets(); return await getSheetData("bucket_skips!A:B"); }
}

export async function GET() {
  try {
    const rows = await readRows();
    const list: BucketSkip[] = rows.slice(1)
      .filter((r) => r[0])
      .map((r) => ({
        practiceId: r[0],
        names: (r[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      }))
      .filter((s) => s.names.length > 0);
    return NextResponse.json(list);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 指定した練習のスキップ対象を丸ごと置き換える（空配列なら解除）
export async function PUT(req: Request) {
  try {
    const { practiceId, names }: { practiceId?: string; names?: string[] } = await req.json();
    if (!practiceId) return NextResponse.json({ error: "practiceId が必要です" }, { status: 400 });
    const clean = (names ?? []).map((n) => (n ?? "").trim()).filter(Boolean);

    const rows = await readRows();
    const idx = rows.findIndex((r, i) => i > 0 && r[0] === practiceId);

    if (clean.length === 0) {
      if (idx > 0) await deleteRow("bucket_skips", idx + 1);
      return NextResponse.json({ ok: true, names: [] });
    }
    if (idx > 0) await updateRow("bucket_skips", idx + 1, [practiceId, clean.join(", ")]);
    else await appendRow("bucket_skips", [practiceId, clean.join(", ")]);
    return NextResponse.json({ ok: true, names: clean });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 練習を削除したときなどに、その練習のスキップ設定も消せるようにする
export async function DELETE(req: Request) {
  try {
    const practiceId = new URL(req.url).searchParams.get("practiceId");
    if (!practiceId) return NextResponse.json({ error: "practiceId が必要です" }, { status: 400 });
    const rows = await readRows();
    const idx = rows.findIndex((r, i) => i > 0 && r[0] === practiceId);
    if (idx > 0) await deleteRow("bucket_skips", idx + 1);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
