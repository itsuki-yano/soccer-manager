import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
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

export async function GET() {
  try {
    const [matchRows, driverRows, expenseRows, settingsRows] = await Promise.all([
      getSheetData("matches!A:I"),
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
    };

    const matches: Match[] = matchRows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], date: r[1], matchType: r[2] ?? "公式戦", matchName: r[3], opponent: r[4],
      venue: r[5], address: r[6], distanceKm: Number(r[7]),
      carCount: Number(r[8]),
      needsSettlement: r[9] === 'true' || r[9] === '1',
    })).sort((a, b) => a.date.localeCompare(b.date));

    const drivers: Driver[] = driverRows.slice(1).filter((r) => r[0]).map((r) => ({
      matchId: r[0], parentName: r[1] ?? "",
    }));

    const expenses: CoachExpense[] = expenseRows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], date: r[1], description: r[2], amount: Number(r[3]), claimed: r[4] ?? "",
    })).sort((a, b) => a.date.localeCompare(b.date));

    const wb = new ExcelJS.Workbook();

    // ===== 公式戦試合日程シート =====
    const scheduleSheet = wb.addWorksheet("公式戦試合日程");
    scheduleSheet.getColumn(1).width = 4;
    scheduleSheet.getColumn(2).width = 12;
    scheduleSheet.getColumn(3).width = 4;
    scheduleSheet.getColumn(4).width = 20;
    scheduleSheet.getColumn(5).width = 18;
    scheduleSheet.getColumn(6).width = 10;
    scheduleSheet.getColumn(7).width = 8;
    scheduleSheet.getColumn(8).width = 8;
    scheduleSheet.getColumn(9).width = 8;
    scheduleSheet.getColumn(10).width = 8;
    scheduleSheet.getColumn(11).width = 8;

    const titleRow = scheduleSheet.addRow([null, `${settings.leagueName}`, null, null, null]);
    titleRow.font = { bold: true, size: 14 };
    scheduleSheet.addRow([]);

    const headerRow = scheduleSheet.addRow(["No.", "日付", "曜", "対戦相手", "会場", "距離×台数", "当番1", "当番2", "当番3", "当番4", "当番5"]);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };
    headerRow.border = { bottom: { style: "thin" } };

    matches.forEach((m, i) => {
      const matchDrivers = drivers.filter((d) => d.matchId === m.id);
      const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
      const { label } = formatDate(m.date);
      const weekday = label.match(/（(.+?)）/)?.[1] ?? "";
      const feeLabel = `${fee}×${m.carCount}`;
      const row = scheduleSheet.addRow([
        i + 1,
        label.replace(/（.+?）/, ""),
        weekday,
        m.opponent ? `vs${m.opponent}` : m.matchName,
        m.venue,
        feeLabel,
        ...matchDrivers.slice(0, 5).map((d) => d.parentName),
      ]);
      if (i % 2 === 0) {
        row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF7FF" } };
      }
    });

    scheduleSheet.addRow([]);
    scheduleSheet.addRow([]);

    // 選手別支払い明細
    const parentMap = new Map<string, { matchId: string; date: string; opponent: string; venue: string; fee: number }[]>();
    for (const d of drivers) {
      const m = matches.find((x) => x.id === d.matchId);
      if (!m) continue;
      const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
      if (!parentMap.has(d.parentName)) parentMap.set(d.parentName, []);
      parentMap.get(d.parentName)!.push({ matchId: m.id, date: m.date, opponent: m.opponent, venue: m.venue, fee });
    }

    for (const [driverName, items] of parentMap) {
      const total = items.reduce((s, x) => s + x.fee, 0);
      const nameRow = scheduleSheet.addRow([null, `${driverName}様`, `計${total}円`]);
      nameRow.font = { bold: true };
      for (const item of items) {
        const { label } = formatDate(item.date);
        scheduleSheet.addRow([null, null, `${item.fee}円`, `${label} ${item.opponent ? `vs${item.opponent}` : ""} ${item.venue} 配車代です。ありがとうございました。`]);
      }
      scheduleSheet.addRow([]);
    }

    // ===== 試合別請求書シート（精算あり試合のみ） =====
    for (const m of matches.filter((x) => x.needsSettlement)) {
      const { mmdd, label } = formatDate(m.date);
      const sheet = wb.addWorksheet(mmdd);
      sheet.getColumn(1).width = 14;
      sheet.getColumn(2).width = 30;

      const fee = calcFee(m.distanceKm, settings.gasPricePerKm);
      const matchDrivers = drivers.filter((d) => d.matchId === m.id);

      const t1 = sheet.addRow(["交通費請求"]);
      t1.font = { bold: true, size: 14 };
      sheet.addRow([]);
      sheet.addRow(["日時", label]);
      sheet.addRow(["種別", m.matchType]);
      if (m.matchName) sheet.addRow(["試合名", m.matchName]);
      if (m.opponent) sheet.addRow(["対戦相手", `vs${m.opponent}`]);
      sheet.addRow(["往復", `${m.distanceKm}km`]);
      sheet.addRow(["場所", m.venue]);
      if (m.address) sheet.addRow([null, m.address]);
      sheet.addRow(["担当台数", `${m.carCount}台`]);
      sheet.addRow(["会計担当者", `${settings.teamName}担当　${settings.accountant}`]);
      sheet.addRow([]);
      sheet.addRow(["配車当番", "支払い金額"]);
      for (const d of matchDrivers) {
        sheet.addRow([d.parentName, `${fee}円`]);
      }
      sheet.addRow([]);
      sheet.addRow(["合計", `${fee * matchDrivers.length}円`]);

      [1, 12].forEach((r) => {
        sheet.getRow(r).font = { bold: true };
      });
    }

    // ===== 飲み物代請求シート =====
    const drinkSheet = wb.addWorksheet("飲み物代請求");
    drinkSheet.getColumn(1).width = 12;
    drinkSheet.getColumn(2).width = 40;
    drinkSheet.getColumn(3).width = 10;
    drinkSheet.getColumn(4).width = 12;

    const drinkTitle = drinkSheet.addRow([null, `${settings.teamName}　コーチ飲み物代・食事代請求`]);
    drinkTitle.font = { bold: true, size: 12 };
    drinkSheet.addRow([]);

    let drinkTotal = 0;
    for (const e of expenses) {
      const row = drinkSheet.addRow([e.date, e.description, e.amount, e.claimed]);
      drinkTotal += e.amount;
      if (e.claimed) {
        row.getCell(4).font = { color: { argb: "FF0070C0" } };
      }
    }
    drinkSheet.addRow([]);
    const totalRow = drinkSheet.addRow(["合計", null, drinkTotal]);
    totalRow.font = { bold: true };

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent("配車請求.xlsx")}`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
