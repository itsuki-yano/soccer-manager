import { NextResponse } from "next/server";
import { getSheetData, appendRow, getSheetsClient } from "@/lib/sheets";
import ExcelJS from "exceljs";
import type { Match, Driver, CoachExpense, Settings } from "@/lib/types";
import { fetchRouteMapImage } from "@/lib/routeMap";

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

// 住所→ルート地図画像(Buffer)のキャッシュを作成（重複住所は1回のみ取得）
async function fetchRouteImages(matchList: MatchWithDrivers[]): Promise<Map<string, Buffer>> {
  const cache = new Map<string, Buffer>();
  if (!process.env.GEOAPIFY_API_KEY) return cache;
  const addresses = [...new Set(matchList.map((m) => m.address).filter(Boolean))];
  const results = await Promise.all(addresses.map(async (a) => ({ a, buf: await fetchRouteMapImage(a) })));
  for (const { a, buf } of results) if (buf) cache.set(a, buf);
  return cache;
}

// A4縦・横1ページfitの共通印刷設定。printTitlesRowを渡すと各ページに見出し行を繰り返す
function setA4Portrait(sheet: ExcelJS.Worksheet, printTitlesRow?: string) {
  sheet.pageSetup = {
    paperSize: 9, // A4
    orientation: "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0.2, footer: 0.2 },
    ...(printTitlesRow ? { printTitlesRow } : {}),
  };
}

function buildStatusSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  matchList: MatchWithDrivers[],
  settings: Settings,
  headerColor: string,
  imageCache: Map<string, Buffer>,
) {
  const sheet = wb.addWorksheet(sheetName);
  setA4Portrait(sheet); // A4縦・横1ページfit（縦はページ区切りで3試合/ページ）
  // 左:情報(A-D)、右:地図(E〜)
  sheet.getColumn(1).width = 8;   // ラベル
  sheet.getColumn(2).width = 26;  // 値（住所など）
  sheet.getColumn(3).width = 8;   // ラベル(台数)
  sheet.getColumn(4).width = 8;   // 値
  sheet.getColumn(5).width = 2;   // 余白

  if (matchList.length === 0) {
    sheet.addRow(["該当する試合がありません"]);
    return;
  }

  const PER_PAGE = 4;       // A4縦に4試合
  const BLOCK_ROWS = 17;    // 1試合ブロックの行数（4つでページ全体に均等配置）
  const thin = { style: "thin" as const };
  const box = { top: thin, bottom: thin, left: thin, right: thin };

  matchList.forEach((m, i) => {
    const carCount = m.matchDrivers.length > 0 ? m.matchDrivers.length : m.carCount;
    const { label } = formatDate(m.date);
    const blockStart = sheet.rowCount; // 0始まりのブロック先頭行（地図アンカー用）

    // 見出し
    const head = sheet.addRow([`${i + 1}. ${label}　${m.opponent ? `vs${m.opponent}` : m.matchName}`]);
    head.font = { bold: true, size: 12 };
    head.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
    // 情報（枠線つき）
    const r1 = sheet.addRow(["会場", m.venue]);
    const r2 = sheet.addRow(["住所", m.address]);
    const r3 = sheet.addRow(["往復", `${m.distanceKm} km`, "台数", `${carCount} 台`]);
    for (const r of [r1, r2, r3]) {
      r.getCell(1).font = { color: { argb: "FF888888" } };
      r.getCell(3).font = { color: { argb: "FF888888" } };
      for (let c = 1; c <= 4; c++) r.getCell(c).border = box;
    }

    // 右側にルート地図
    const buf = imageCache.get(m.address);
    if (buf) {
      const imageId = wb.addImage({ buffer: new Uint8Array(buf) as unknown as ExcelJS.Buffer, extension: "png" });
      sheet.addImage(imageId, { tl: { col: 5, row: blockStart }, ext: { width: 360, height: 240 } });
    }

    // ブロック高さを揃える（既に4行使用済み → 残りを空行で埋める）
    const used = sheet.rowCount - blockStart;
    for (let k = used; k < BLOCK_ROWS; k++) sheet.addRow([]);

    // 4試合ごとにページ区切り
    if ((i + 1) % PER_PAGE === 0 && i < matchList.length - 1) {
      sheet.getRow(sheet.rowCount).addPageBreak();
    }
  });

  // 末尾に会計担当者（頭にチーム名）
  const accountant = settings.accountant ? `${settings.teamName} ${settings.accountant}` : settings.teamName;
  sheet.addRow([]);
  const accRow = sheet.addRow([`会計担当者: ${accountant}`]);
  accRow.font = { bold: true };
}

// 配車担当者明細（別シート）: 試合ごとに配車担当者を一覧
function buildDriverDetailSheet(wb: ExcelJS.Workbook, matchList: MatchWithDrivers[]) {
  const sheet = wb.addWorksheet("配車担当者明細");
  setA4Portrait(sheet, "3:3"); // 見出し行(3行目)を各ページに繰り返す
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 18;
  sheet.getColumn(4).width = 6;
  sheet.getColumn(5).width = 34;

  const title = sheet.addRow(["配車担当者明細"]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);
  const thin = { style: "thin" as const };
  const box = { top: thin, bottom: thin, left: thin, right: thin };
  const hdr = sheet.addRow(["日付", "試合名", "会場", "台数", "配車担当者"]);
  hdr.font = { bold: true };
  hdr.eachCell((c) => { c.border = box; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9E9E9" } }; });

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
    row.alignment = { vertical: "top", wrapText: true };
    for (let c = 1; c <= 5; c++) row.getCell(c).border = box;
    if (i % 2 === 0) {
      for (let c = 1; c <= 5; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
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

async function buildWorkbook(wb: ExcelJS.Workbook, exportType: string, settlementMatches: MatchWithDrivers[], settings: Settings, expenses: CoachExpense[]) {
  // ルート地図画像を事前取得（GEOAPIFY_API_KEY設定時のみ）
  const imageCache = await fetchRouteImages(settlementMatches);

  if (exportType === "billing") {
    buildStatusSheet(wb, "請求中", settlementMatches, settings, "FFFFF2CC", imageCache);
  } else if (exportType === "issue-unbilled") {
    // 未請求→請求中に変更済みなので請求中として出力
    buildStatusSheet(wb, "請求中（新規発行）", settlementMatches, settings, "FFFFF2CC", imageCache);
  } else if (exportType === "settled") {
    buildStatusSheet(wb, "精算済み", settlementMatches, settings, "FFD9EAD3", imageCache);
  } else {
    // all: ステータス別3シート
    buildStatusSheet(wb, "未請求", settlementMatches.filter((m) => !m.settlementStatus), settings, "FFD9D9D9", imageCache);
    buildStatusSheet(wb, "請求中", settlementMatches.filter((m) => m.settlementStatus === "請求中"), settings, "FFFFF2CC", imageCache);
    buildStatusSheet(wb, "精算済み", settlementMatches.filter((m) => m.settlementStatus === "精算済み"), settings, "FFD9EAD3", imageCache);
  }

  // 配車担当者明細（別シート）
  buildDriverDetailSheet(wb, settlementMatches);

  // 飲み物代
  const drinkSheet = wb.addWorksheet("飲み物代請求");
  buildDrinkSheet(drinkSheet, expenses, settings);
}

// 飲み物代・食事代シートを構築（日付・内容・購入者・金額・レシート）
function buildDrinkSheet(sheet: ExcelJS.Worksheet, expenses: CoachExpense[], settings: Settings) {
  setA4Portrait(sheet, "3:3"); // 見出し行(3行目)を各ページに繰り返す
  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 30;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 10;
  sheet.getColumn(5).width = 12;
  const thin = { style: "thin" as const };
  const box = { top: thin, bottom: thin, left: thin, right: thin };

  const title = sheet.addRow([`${settings.teamName}　コーチ飲み物代・食事代請求`]);
  title.font = { bold: true, size: 14 };
  sheet.addRow([]);
  const header = sheet.addRow(["日付", "内容", "購入者", "金額", "レシート"]);
  header.font = { bold: true };
  header.eachCell((c) => { c.border = box; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE9E9E9" } }; });

  let total = 0;
  expenses.forEach((e, i) => {
    const row = sheet.addRow([e.date, e.description, e.purchaserName || "（チーム）", e.amount, null]);
    row.alignment = { vertical: "top", wrapText: true };
    if (e.receiptUrl) {
      const cell = row.getCell(5);
      cell.value = { text: "画像を開く", hyperlink: e.receiptUrl };
      cell.font = { color: { argb: "FF0563C1" }, underline: true };
    }
    for (let c = 1; c <= 5; c++) row.getCell(c).border = box;
    if (i % 2 === 0) {
      for (let c = 1; c <= 5; c++) row.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
    }
    total += e.amount;
  });
  const sumRow = sheet.addRow(["合計", null, null, total]);
  sumRow.font = { bold: true };
  for (let c = 1; c <= 5; c++) sumRow.getCell(c).border = box;
}

// GET: 旧互換（全ステータス出力）
export async function GET() {
  try {
    const { settings, matches, drivers, expenses } = await loadData();
    const settlementMatches: MatchWithDrivers[] = matches
      .filter((m) => m.needsSettlement)
      .map((m) => ({ ...m, matchDrivers: drivers.filter((d) => d.matchId === m.id) }));

    const wb = new ExcelJS.Workbook();
    const imageCache = await fetchRouteImages(settlementMatches);
    buildStatusSheet(wb, "未請求", settlementMatches.filter((m) => !m.settlementStatus), settings, "FFD9D9D9", imageCache);
    buildStatusSheet(wb, "請求中", settlementMatches.filter((m) => m.settlementStatus === "請求中"), settings, "FFFFF2CC", imageCache);
    buildStatusSheet(wb, "精算済み", settlementMatches.filter((m) => m.settlementStatus === "精算済み"), settings, "FFD9EAD3", imageCache);
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
    await buildWorkbook(wb, exportType, settlementMatches, settings, expenses);
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
