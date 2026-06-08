import { NextResponse } from "next/server";
import { getSheetData, appendRow, getSheetsClient } from "@/lib/sheets";
import ExcelJS from "exceljs";
import type { Match, Driver, CoachExpense, Settings } from "@/lib/types";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const w = weekdays[d.getDay()];
  return { label: `${y}/${m}/${day}（${w}）`, mmdd: `${m}.${day}` };
}

function calcFee(distanceKm: number, gasPricePerKm: number): number {
  return Math.round(distanceKm * gasPricePerKm / 10) * 10;
}

type MatchWithDrivers = Match & { matchDrivers: Driver[] };

function buildStatusSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  matchList: MatchWithDrivers[],
  settings: Settings,
  headerColor: string,
) {
  const sheet = wb.addWorksheet(sheetName);
  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 4;
  sheet.getColumn(4).width = 20;
  sheet.getColumn(5).width = 18;
  sheet.getColumn(6).width = 8;
  sheet.getColumn(7).width = 8;
  sheet.getColumn(8).width = 6;
  sheet.getColumn(9).width = 8;
  sheet.getColumn(10).width = 10;
  sheet.getColumn(11).width = 10;
  sheet.getColumn(12).width = 10;
  sheet.getColumn(13).width = 10;
  sheet.getColumn(14).width = 10;

  const titleRow = sheet.addRow([sheetName]);
  titleRow.font = { bold: true, size: 14 };
  sheet.addRow([]);

  if (matchList.length === 0) {
    sheet.addRow(["該当する試合がありません"]);
    return;
  }

  const hdr = sheet.addRow(["No.", "日付", "曜", "対戦相手/試合名", "会場", "片道(km)", "1台費用", "台数", "合計費用", "当番1", "当番2", "当番3", "当番4", "当番5"]);
  hdr.font = { bold: true };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
  hdr.border = { bottom: { style: "thin" } };

  const totalFee = matchList.reduce((s, m) => {
    const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
    return s + fee * m.matchDrivers.length;
  }, 0);

  matchList.forEach((m, i) => {
    const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
    const carCount = m.matchDrivers.length;
    const { label } = formatDate(m.date);
    const weekday = label.match(/（(.+?)）/)?.[1] ?? "";
    const row = sheet.addRow([
      i + 1,
      label.replace(/（.+?）/, ""),
      weekday,
      m.opponent ? `vs${m.opponent}` : m.matchName,
      m.venue,
      m.distanceKm,
      fee,
      carCount,
      fee * carCount,
      ...m.matchDrivers.slice(0, 5).map((d) => d.parentName),
    ]);
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
    }
    row.getCell(9).font = { bold: true };
  });

  const sumRow = sheet.addRow([null, null, null, null, null, null, null, "合計", totalFee]);
  sumRow.font = { bold: true };
  sumRow.getCell(9).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFD966" } };

  sheet.addRow([]);
  sheet.addRow([]);

  // 当番別支払い明細
  const personMap = new Map<string, { date: string; label: string; opponent: string; matchName: string; venue: string; distanceKm: number; fee: number }[]>();
  for (const m of matchList) {
    const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
    const { label } = formatDate(m.date);
    for (const d of m.matchDrivers) {
      if (!personMap.has(d.parentName)) personMap.set(d.parentName, []);
      personMap.get(d.parentName)!.push({ date: m.date, label, opponent: m.opponent, matchName: m.matchName, venue: m.venue, distanceKm: m.distanceKm, fee });
    }
  }
  for (const [name, items] of personMap) {
    const total = items.reduce((s, x) => s + x.fee, 0);
    const nameRow = sheet.addRow([null, name, `計 ${total}円`]);
    nameRow.font = { bold: true };
    for (const item of items) {
      sheet.addRow([null, null, `${item.fee}円`, `${item.label} ${item.opponent ? `vs${item.opponent}` : item.matchName} ${item.venue} 片道${item.distanceKm}km`]);
    }
    sheet.addRow([]);
  }
}

async function loadData() {
  const [matchRows, driverRows, expenseRows, settingsRows] = await Promise.all([
    getSheetData("matches!A:N"),
    getSheetData("drivers!A:B"),
    getSheetData("coach_expenses!A:E"),
    getSheetData("settings!A:B"),
  ]);

  const settingsMap: Record<string, string> = {};
  settingsRows.slice(1).forEach((r) => { if (r[0]) settingsMap[r[0]] = r[1] ?? ""; });
  const settings: Settings = {
    teamName: settingsMap.teamName ?? "トラヴェッソ 5年生",
    gasPricePerKm: Number(settingsMap.gasPricePerKm ?? 16),
    accountant: settingsMap.accountant ?? "",
    leagueName: settingsMap.leagueName ?? "西三河リーグ",
    logoUrl: settingsMap.logoUrl ?? "",
  };

  const matches: Match[] = matchRows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[0], date: r[1], matchType: r[2] ?? "公式戦", matchName: r[3], opponent: r[4],
    venue: r[5], address: r[6], distanceKm: Number(r[7]),
    carCount: Number(r[8]),
    needsSettlement: r[9]?.toLowerCase() === "true" || r[9] === "1",
    bandUid: r[10] ?? "", equipmentBringIn: r[11] ?? "", equipmentBringOut: r[12] ?? "",
    settlementStatus: r[13] ?? "",
  })).sort((a, b) => a.date.localeCompare(b.date));

  const drivers: Driver[] = driverRows.slice(1).filter((r) => r[0]).map((r) => ({
    matchId: r[0], parentName: r[1] ?? "",
  }));

  const expenses: CoachExpense[] = expenseRows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[0], date: r[1], description: r[2], amount: Number(r[3]), claimed: r[4] ?? "",
  })).sort((a, b) => a.date.localeCompare(b.date));

  return { settings, matches, matchRows, drivers, expenses };
}

// 未請求を一括で請求中に変更
async function bulkIssue(matchRows: string[][], unbilledIds: Set<string>) {
  if (unbilledIds.size === 0) return;
  const sheets = await getSheetsClient();
  const data = matchRows.reduce<{ range: string; values: string[][] }[]>((acc, row, idx) => {
    if (idx === 0) return acc; // ヘッダースキップ
    if (unbilledIds.has(row[0])) {
      acc.push({ range: `matches!N${idx + 1}`, values: [["請求中"]] });
    }
    return acc;
  }, []);
  if (data.length === 0) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID!,
    requestBody: { valueInputOption: "USER_ENTERED", data },
  });
}

async function logExport(exportType: string, dateFrom: string, dateTo: string, matchCount: number) {
  const id = new Date().toISOString();
  await appendRow("export_history", [id, exportType, id, dateFrom, dateTo, matchCount]);
}

function buildWorkbook(wb: ExcelJS.Workbook, exportType: string, settlementMatches: MatchWithDrivers[], settings: Settings, expenses: CoachExpense[]) {
  if (exportType === "billing") {
    buildStatusSheet(wb, "請求中", settlementMatches, settings, "FFFFF2CC");
  } else if (exportType === "issue-unbilled") {
    // 未請求→請求中に変更済みなので請求中として出力
    buildStatusSheet(wb, "請求中（新規発行）", settlementMatches, settings, "FFFFF2CC");
  } else if (exportType === "settled") {
    buildStatusSheet(wb, "精算済み", settlementMatches, settings, "FFD9EAD3");
  } else {
    // all: ステータス別3シート
    buildStatusSheet(wb, "未請求", settlementMatches.filter((m) => !m.settlementStatus), settings, "FFD9D9D9");
    buildStatusSheet(wb, "請求中", settlementMatches.filter((m) => m.settlementStatus === "請求中"), settings, "FFFFF2CC");
    buildStatusSheet(wb, "精算済み", settlementMatches.filter((m) => m.settlementStatus === "精算済み"), settings, "FFD9EAD3");
  }

  // 飲み物代
  const drinkSheet = wb.addWorksheet("飲み物代請求");
  drinkSheet.getColumn(1).width = 12;
  drinkSheet.getColumn(2).width = 40;
  drinkSheet.getColumn(3).width = 10;
  const drinkTitle = drinkSheet.addRow([null, `${settings.teamName}　コーチ飲み物代・食事代請求`]);
  drinkTitle.font = { bold: true, size: 12 };
  drinkSheet.addRow([]);
  let drinkTotal = 0;
  for (const e of expenses) { drinkSheet.addRow([e.date, e.description, e.amount]); drinkTotal += e.amount; }
  drinkSheet.addRow([]);
  drinkSheet.addRow(["合計", null, drinkTotal]).font = { bold: true };
}

// GET: 旧互換（全ステータス出力）
export async function GET() {
  try {
    const { settings, matches, drivers, expenses } = await loadData();
    const settlementMatches: MatchWithDrivers[] = matches
      .filter((m) => m.needsSettlement)
      .map((m) => ({ ...m, matchDrivers: drivers.filter((d) => d.matchId === m.id) }));

    const wb = new ExcelJS.Workbook();
    buildStatusSheet(wb, "未請求", settlementMatches.filter((m) => !m.settlementStatus), settings, "FFD9D9D9");
    buildStatusSheet(wb, "請求中", settlementMatches.filter((m) => m.settlementStatus === "請求中"), settings, "FFFFF2CC");
    buildStatusSheet(wb, "精算済み", settlementMatches.filter((m) => m.settlementStatus === "精算済み"), settings, "FFD9EAD3");
    const drinkSheet = wb.addWorksheet("飲み物代請求");
    drinkSheet.getColumn(2).width = 40; drinkSheet.getColumn(3).width = 10;
    const dt = drinkSheet.addRow([null, `${settings.teamName}　コーチ飲み物代・食事代請求`]); dt.font = { bold: true, size: 12 };
    drinkSheet.addRow([]);
    let tot = 0; for (const e of expenses) { drinkSheet.addRow([e.date, e.description, e.amount]); tot += e.amount; }
    drinkSheet.addRow([]); drinkSheet.addRow(["合計", null, tot]).font = { bold: true };
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("配車請求.xlsx")}` } });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST: 種別指定出力
export async function POST(req: Request) {
  try {
    const body = await req.json() as { exportType: string; dateFrom?: string; dateTo?: string };
    const { exportType, dateFrom = "", dateTo = "" } = body;

    const { settings, matches, matchRows, drivers, expenses } = await loadData();

    // 日付フィルタ
    const inRange = (date: string) => {
      if (dateFrom && date < dateFrom) return false;
      if (dateTo && date > dateTo) return false;
      return true;
    };

    let filteredMatches = matches.filter((m) => m.needsSettlement && inRange(m.date));

    // 未請求発行: 対象を請求中に変更
    if (exportType === "issue-unbilled") {
      const unbilledIds = new Set(filteredMatches.filter((m) => !m.settlementStatus).map((m) => m.id));
      await bulkIssue(matchRows, unbilledIds);
      // ローカルにも反映
      filteredMatches = filteredMatches.map((m) =>
        unbilledIds.has(m.id) ? { ...m, settlementStatus: "請求中" } : m
      );
    }

    // ステータスフィルタ
    let statusFiltered: Match[];
    if (exportType === "billing") {
      statusFiltered = filteredMatches.filter((m) => m.settlementStatus === "請求中");
    } else if (exportType === "issue-unbilled") {
      statusFiltered = filteredMatches.filter((m) => m.settlementStatus === "請求中");
    } else if (exportType === "settled") {
      statusFiltered = filteredMatches.filter((m) => m.settlementStatus === "精算済み");
    } else {
      statusFiltered = filteredMatches;
    }

    const settlementMatches: MatchWithDrivers[] = statusFiltered.map((m) => ({
      ...m, matchDrivers: drivers.filter((d) => d.matchId === m.id),
    }));

    // 出力ログ記録
    await logExport(exportType, dateFrom, dateTo, settlementMatches.length).catch(() => {});

    const wb = new ExcelJS.Workbook();
    buildWorkbook(wb, exportType, settlementMatches, settings, expenses);
    const buf = await wb.xlsx.writeBuffer();

    const typeLabels: Record<string, string> = {
      billing: "請求中",
      "issue-unbilled": "未請求発行",
      settled: "精算済み",
      all: "全データ",
    };
    const filename = `配車請求_${typeLabels[exportType] ?? exportType}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "X-Match-Count": String(settlementMatches.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
