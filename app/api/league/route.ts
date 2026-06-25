import { NextResponse } from "next/server";
import { getSheetData } from "@/lib/sheets";

const DEFAULT_URL = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&#?\w+;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function getRows(tableHtml: string): string[][] {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]);
  return rows.map((r) =>
    [...r.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1]))
  );
}

type TeamStat = {
  rank: number; name: string; played: number;
  win: number; draw: number; loss: number;
  gf: number; ga: number; gd: number; points: number;
};

export async function GET() {
  try {
    // 設定からURLを取得（なければデフォルト）
    let url = DEFAULT_URL;
    try {
      const rows = await getSheetData("settings!A:B");
      const found = rows.slice(1).find((r) => r[0] === "leagueTableUrl");
      if (found && found[1]) url = found[1];
    } catch { /* 設定未取得時はデフォルト */ }

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SoccerManager/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();

    // リーグ名（最初に出てくる「YYYY年度 …リーグ…【…】」）
    const nameMatch = html.match(/\d{4}年度[^<>【]*リーグ[^<>【]*【[^】<>]*】/);
    const leagueName = nameMatch ? stripTags(nameMatch[0]) : "リーグ戦";

    const tables = [...html.matchAll(/<table[^>]*>[\s\S]*?<\/table>/g)].map((m) => m[0]);

    // TABLE0: 暫定順位 + チーム名 / TABLE1: 星取表
    const standRows = tables[0] ? getRows(tables[0]) : [];
    const order: { rank: number; name: string }[] = standRows
      .slice(1)
      .filter((r) => r.length >= 2 && r[1])
      .map((r) => ({ rank: parseInt(r[0], 10) || 0, name: r[1] }));

    const matrixRows = tables[1] ? getRows(tables[1]) : [];
    const teams = matrixRows[0] ?? [];
    const stats: Record<string, TeamStat> = {};
    teams.forEach((t, i) => {
      stats[t] = { rank: 0, name: t, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0 };
      // 各チームの対戦結果（行 i+1）
      const row = matrixRows[i + 1] ?? [];
      row.forEach((cell, j) => {
        if (i === j || !cell || cell === "-") return;
        const m = cell.match(/(\d+)([○●△])(\d+)/);
        if (!m) return;
        const gf = parseInt(m[1], 10), res2 = m[2], ga = parseInt(m[3], 10);
        const s = stats[t];
        s.played++; s.gf += gf; s.ga += ga;
        if (res2 === "○") { s.win++; s.points += 3; }
        else if (res2 === "△") { s.draw++; s.points += 1; }
        else { s.loss++; }
      });
      stats[t].gd = stats[t].gf - stats[t].ga;
    });

    // サイトの暫定順位順に並べ、統計を付与
    const standings: TeamStat[] = (order.length > 0
      ? order.map((o) => ({ ...(stats[o.name] ?? { name: o.name, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0 }), rank: o.rank, name: o.name }))
      : teams.map((t) => stats[t]).sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf).map((s, i) => ({ ...s, rank: i + 1 }))
    );

    return NextResponse.json({
      leagueName,
      url,
      standings,
      teams,
      matrix: matrixRows.slice(1).map((r) => r), // 星取表データ行
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
