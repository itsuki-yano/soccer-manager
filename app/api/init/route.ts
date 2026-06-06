import { NextResponse } from "next/server";
import { ensureSheets } from "@/lib/sheets";

export async function POST() {
  try {
    await ensureSheets();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
