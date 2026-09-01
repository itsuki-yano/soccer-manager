import { NextResponse } from "next/server";
import { getSheetData, updateRow, deleteRow } from "@/lib/sheets";
import type { Parent } from "@/lib/types";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body: Omit<Parent, "id"> = await req.json();
    const rows = await getSheetData("parents!A:K");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    await updateRow("parents", idx + 1, [id, body.playerName, body.furigana, body.jerseyNumber, body.group, body.carCapacity, body.bucketOrder ?? 0, body.uniformNumber ?? "", body.blueBibsNumber ?? "", body.yellowBibsNumber ?? "", body.blueBibsMemo ?? ""]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// 退団などで選手を削除したとき、当番のローテーションに名前が残らないよう関連データを整理する。
// 過去の記録（実施済みの配車・バケツ当番）は履歴として残す。
async function cleanupReferences(playerName: string): Promise<{ swaps: number; drivers: number; bucketDuties: number }> {
  const result = { swaps: 0, drivers: 0, bucketDuties: 0 };
  if (!playerName) return result;

  const today = new Date().toISOString().slice(0, 10);

  // 1) 当番交代(duty_swaps): 今後のローテーションに名前を戻してしまうため、関わる交代は全て削除
  try {
    const rows = await getSheetData("duty_swaps!A:G");
    // 行番号がずれないよう後ろから削除
    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      if (!r?.[0]) continue;
      if (r[1] === playerName || r[2] === playerName) {
        await deleteRow("duty_swaps", i + 1);
        result.swaps++;
      }
    }
  } catch { /* シート未作成などは無視 */ }

  // 2) 配車当番(drivers): これからの試合の担当のみ解除（過去は履歴として残す）
  try {
    const matchRows = await getSheetData("matches!A:B");
    const futureMatchIds = new Set(
      matchRows.slice(1).filter((r) => r[0] && (r[1] ?? "") >= today).map((r) => r[0])
    );
    const rows = await getSheetData("drivers!A:B");
    for (let i = rows.length - 1; i >= 1; i--) {
      const r = rows[i];
      if (!r?.[0]) continue;
      if (r[1] === playerName && futureMatchIds.has(r[0])) {
        await deleteRow("drivers", i + 1);
        result.drivers++;
      }
    }
  } catch { /* シート未作成などは無視 */ }

  // 3) バケツ当番(bucket_duties): これからの練習の担当のみ空欄に（過去は履歴として残す）
  try {
    const practiceRows = await getSheetData("practices!A:B");
    const futurePracticeIds = new Set(
      practiceRows.slice(1).filter((r) => r[0] && (r[1] ?? "") >= today).map((r) => r[0])
    );
    const rows = await getSheetData("bucket_duties!A:D");
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[0] || !futurePracticeIds.has(r[1] ?? "")) continue;
      const bring = r[2] ?? "";
      const ret = r[3] ?? "";
      if (bring === playerName || ret === playerName) {
        await updateRow("bucket_duties", i + 1, [
          r[0], r[1] ?? "",
          bring === playerName ? "" : bring,
          ret === playerName ? "" : ret,
        ]);
        result.bucketDuties++;
      }
    }
  } catch { /* シート未作成などは無視 */ }

  return result;
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const rows = await getSheetData("parents!A:K");
    const idx = rows.findIndex((r) => r[0] === id);
    if (idx < 0) return NextResponse.json({ error: "not found" }, { status: 404 });
    const playerName = rows[idx][1] ?? "";
    await deleteRow("parents", idx + 1);
    const cleaned = await cleanupReferences(playerName);
    return NextResponse.json({ ok: true, cleaned });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
