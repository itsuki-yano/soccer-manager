import { NextResponse } from "next/server";
import { getSheetData, appendRow, ensureSheets } from "@/lib/sheets";
import type { Memo } from "@/lib/types";

async function getMemoRows() {
  try {
    return await getSheetData("memos!A:D");
  } catch {
    await ensureSheets();
    return await getSheetData("memos!A:D");
  }
}

export async function GET() {
  try {
    const rows = await getMemoRows();
    const memos: Memo[] = rows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], content: r[1] ?? "", createdAt: r[2] ?? "", updatedAt: r[3] ?? "",
    }));
    return NextResponse.json(memos);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { content } = await req.json();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      await appendRow("memos", [id, content, now, now]);
    } catch {
      await ensureSheets();
      await appendRow("memos", [id, content, now, now]);
    }
    return NextResponse.json({ id, createdAt: now, updatedAt: now });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
