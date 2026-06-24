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
  sheet.getColumn(4).width = 22;
  sheet.getColumn(5).width = 20;
  sheet.getColumn(6).width = 30;
  sheet.getColumn(7).width = 9;
  sheet.getColumn(8).width = 6;

  const titleRow = sheet.addRow([sheetName]);
  titleRow.font = { bold: true, size: 14 };
  sheet.addRow([]);

  if (matchList.length === 0) {
    sheet.addRow(["該当する試合がありません"]);
    return;
  }

  const hdr = sheet.addRow(["No.", "日付", "曜", "試合名", "会場", "住所", "往復(km)", "台数"]);
  hdr.font = { bold: true };
  hdr.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
  hdr.border = { bottom: { style: "thin" } };

  matchList.forEach((m, i) => {
    const carCount = m.matchDrivers.length > 0 ? m.matchDrivers.length : m.carCount;
    const { label } = formatDate(m.date);
    const weekday = label.match(/（(.+?)）/)?.[1] ?? "";
    const row = sheet.addRow([
      i + 1,
      label.replace(/（.+?）/, ""),
      weekday,
      m.opponent ? `vs${m.opponent}` : m.matchName,
      m.venue,
      m.address,
      m.distanceKm,
      carCount,
    ]);
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
    }
  });

  // 明細下段に会計担当者を1セルのみ記載（頭にチーム名）
  const accountant = settings.accountant ? `${settings.teamName} ${settings.accountant}` : settings.teamName;
  sheet.addRow([]);
  const accRow = sheet.addRow([`会計担当者: ${accountant}`]);
  accRow.font = { bold: true };
}

// 配車担当者明細（別シート）: 試合ごとに配車担当者を一覧
function buildDriverDetailSheet(wb: ExcelJS.Workbook, matchList: MatchWithDrivers[]) {
  const sheet = wb.addWorksheet("配車担当者明細");
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 22;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 6;
  sheet.getColumn(5).width = 40;

  const title = sheet.addRow(["配車担当者明細"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);
  const hdr = sheet.addRow(["日付", "試合名", "会場", "台数", "配車担当者"]);
  hdr.font = { bold: true };
  hdr.border = { bottom: { style: "thin" } };

  matchList.forEach((m, i) => {
    const { label } = formatDate(m.date);
    const names = m.matchDrivers.map((d) => d.parentName);
    const row = sheet.addRow([
      label.replace(/（.+?）/, ""),
      m.opponent ? `vs${m.opponent}` : m.matchName,
      m.venue,
      names.length,
      names.join("、"),
    ]);
    if (i % 2 === 0) {
      row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
    }
  });
}

async function loadData() {
  const [matchRows, driverRows, expenseRows, settingsRows] = await Promise.all([
    getSheetData("matches!A:N"),
    getSheetData("drivers!A:B"),
    getSheetData("coach_expenses!A:G"),
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
    bucketDutyStartDate: settingsMap.bucketDutyStartDate ?? "",
    bucketDutyEndDate: settingsMap.bucketDutyEndDate ?? "",
  };

  const matches: Match[] = matchRows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[0], date: r[1], matchType: r[2] ?? "公式戦", matchName: r[3], opponent: r[4],
    venue: r[5], address: r[6], distanceKm: Number(r[7]),
    carCount: Number(r[8]),
    needsSettlement: r[9]?.toLowerCase() === "true" || r[9] === "1",
    bandUid: r[10] ?? "", equipmentBringIn: r[11] ?? "", equipmentBringOut: r[12] ?? "",
    settlementStatus: r[13] ?? "",
    skippedDrivers: r[14] ?? "",
  })).sort((a, b) => a.date.localeCompare(b.date));

  const drivers: Driver[] = driverRows.slice(1).filter((r) => r[0]).map((r) => ({
    matchId: r[0], parentName: r[1] ?? "",
  }));

  const expenses: CoachExpense[] = expenseRows.slice(1).filter((r) => r[0]).map((r) => ({
    id: r[0], date: r[1], description: r[2], amount: Number(r[3]), claimed: r[4] ?? "", purchaserName: r[5] ?? "", receiptUrl: r[6] ?? "",
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

  // 配車担当者明細（別シート）
  buildDriverDetailSheet(wb, settlementMatches);

  // 飲み物代
  const drinkSheet = wb.addWorksheet("飲み物代請求");
  buildDrinkSheet(drinkSheet, expenses, settings);
}

// 飲み物代・食事代シートを構築（日付・内容・購入者・金額・レシート）
function buildDrinkSheet(sheet: ExcelJS.Worksheet, expenses: CoachExpense[], settings: Settings) {
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 40;
  sheet.getColumn(3).width = 14;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 30;
  const title = sheet.addRow([null, `${settings.teamName}　コーチ飲み物代・食事代請求`]);
  title.font = { bold: true, size: 12 };
  sheet.addRow([]);
  const header = sheet.addRow(["日付", "内容", "購入者", "金額", "レシート"]);
  header.font = { bold: true };
  let total = 0;
  for (const e of expenses) {
    const row = sheet.addRow([e.date, e.description, e.purchaserName || "（チーム）", e.amount, null]);
    if (e.receiptUrl) {
      const cell = row.getCell(5);
      cell.value = { text: "画像を開く", hyperlink: e.receiptUrl };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
    total += e.amount;
  }
  sheet.addRow([]);
  sheet.addRow(["合計", null, null, total]).font = { bold: true };
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
    buildDriverDetailSheet(wb, settlementMatches);
    const drinkSheet = wb.addWorksheet("飲み物代請求");
    buildDrinkSheet(drinkSheet, expenses, settings);
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
