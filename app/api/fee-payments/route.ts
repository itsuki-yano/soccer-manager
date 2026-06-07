import { NextResponse } from "next/server";
import { getSheetData, appendRow, updateRow, ensureSheets } from "@/lib/sheets";
import type { FeePayment } from "@/lib/types";

function rowToPayment(r: string[]): FeePayment {
  return {
    feeId: r[0] ?? "",
    parentId: r[1] ?? "",
    paid: r[2] === "true",
    paidAt: r[3] ?? "",
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const feeId = searchParams.get("feeId");
    const rows = await getSheetData("fee_payments!A:D");
    const payments = rows.slice(1).filter((r) => r[0]).map(rowToPayment);
    return NextResponse.json(feeId ? payments.filter((p) => p.feeId === feeId) : payments);
  } catch (e) {
    if (String(e).includes("Unable to parse range")) {
      await ensureSheets();
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body: FeePayment = await req.json();
    const rows = await getSheetData("fee_payments!A:D");
    const idx = rows.findIndex((r) => r[0] === body.feeId && r[1] === body.parentId);
    const paidAt = body.paid ? (body.paidAt || new Date().toISOString()) : "";
    const row = [body.feeId, body.parentId, body.paid ? "true" : "false", paidAt];
    if (idx >= 1) {
      await updateRow("fee_payments", idx + 1, row);
    } else {
      await appendRow("fee_payments", row);
    }
    return NextResponse.json({ ok: true, paidAt });
  } catch (e) {
    if (String(e).includes("Unable to parse range")) {
      await ensureSheets();
    }
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
