import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";
import type { Match, Driver, CoachExpense, Settings } from "@/lib/types";

function calcFee(distanceKm: number, gasPricePerKm: number): number {
  return Math.round(distanceKm * gasPricePerKm / 10) * 10;
}

export async function GET() {
  try {
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
    };

    const matches: Match[] = matchRows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], date: r[1], matchType: r[2] ?? "公式戦", matchName: r[3], opponent: r[4],
      venue: r[5], address: r[6], distanceKm: Number(r[7]),
      carCount: Number(r[8]),
      needsSettlement: r[9] === "true" || r[9] === "1",
      bandUid: r[10] ?? "", equipmentBringIn: r[11] ?? "", equipmentBringOut: r[12] ?? "",
      settlementStatus: r[13] ?? "",
    })).sort((a, b) => a.date.localeCompare(b.date));

    const drivers: Driver[] = driverRows.slice(1).filter((r) => r[0]).map((r) => ({
      matchId: r[0], parentName: r[1] ?? "",
    }));

    const expenses: CoachExpense[] = expenseRows.slice(1).filter((r) => r[0]).map((r) => ({
      id: r[0], date: r[1], description: r[2], amount: Number(r[3]), claimed: r[4] ?? "",
    })).sort((a, b) => a.date.localeCompare(b.date));

    const settlementMatches = matches.filter((m) => m.needsSettlement);

    const matchPreviews = settlementMatches.map((m) => {
      const matchDrivers = drivers.filter((d) => d.matchId === m.id);
      const feePerCar = calcFee(m.distanceKm, settings.gasPricePerKm);
      const totalFee = feePerCar * m.carCount;
      return {
        id: m.id,
        date: m.date,
        matchName: m.matchName || (m.opponent ? `vs ${m.opponent}` : m.matchType),
        matchType: m.matchType,
        venue: m.venue,
        distanceKm: m.distanceKm,
        carCount: m.carCount,
        gasPricePerKm: settings.gasPricePerKm,
        feePerCar,
        totalFee,
        drivers: matchDrivers.map((d) => d.parentName),
        settlementStatus: m.settlementStatus,
      };
    });

    const coachExpenseTotal = expenses.reduce((s, e) => s + e.amount, 0);
    const transportTotal = matchPreviews.reduce((s, m) => s + m.totalFee, 0);

    return NextResponse.json({
      settings,
      matches: matchPreviews,
      coachExpenses: expenses,
      coachExpenseTotal,
      transportTotal,
      grandTotal: transportTotal + coachExpenseTotal,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
