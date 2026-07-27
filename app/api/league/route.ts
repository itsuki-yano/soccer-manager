import { NextResponse } from "next/server";
import { getSheetData, getSheetsClient, ensureSheets } from "@/lib/sheets";

export const dynamic = "force-dynamic";

const DEFAULT_URL = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

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

type LeagueData = {
  leagueName: string;
  url: string;
  standings: TeamStat[];
  teams: string[];
  matrix: string[][];
  fetchedAt: string;
};

function parseLeagueHtml(html: string, url: string): LeagueData {
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

  // 星取表。ブラウザ上のDOMを送ると空の行が混ざることがあるため、セルを持つ行だけを使う
  const matrixRows = (tables[1] ? getRows(tables[1]) : []).filter((r) => r.length > 0);
  const teams = matrixRows[0] ?? [];
  // データ行は「チーム数」分のセルを持つ行のみ。行頭に見出しセルが付く場合は末尾側を採用
  const matrix = matrixRows
    .slice(1)
    .filter((r) => r.length >= teams.length)
    .map((r) => (r.length > teams.length ? r.slice(r.length - teams.length) : r))
    .slice(0, teams.length);

  const stats: Record<string, TeamStat> = {};
  teams.forEach((t, i) => {
    stats[t] = { rank: 0, name: t, played: 0, win: 0, draw: 0, loss: 0, gf: 0, ga: 0, gd: 0, points: 0 };
    const row = matrix[i] ?? [];
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

  if (standings.length === 0 && teams.length === 0) throw new Error("表を解析できませんでした");
  // 行とチームの数が合わない＝表を読み違えているので、ずれたまま保存しない
  if (teams.length > 0 && matrix.length !== teams.length) {
    throw new Error(`星取表を正しく読み取れませんでした（チーム${teams.length}・行${matrix.length}）`);
  }

  return { leagueName, url, standings, teams, matrix, fetchedAt: new Date().toISOString() };
}

async function getLeagueUrl(): Promise<string> {
  try {
    const rows = await getSheetData("settings!A:B");
    const found = rows.slice(1).find((r) => r[0] === "leagueTableUrl");
    if (found && found[1]) return found[1];
  } catch { /* 設定未取得時はデフォルト */ }
  return DEFAULT_URL;
}

// 直近に取得できた戦績（取得元サイトがbot対策で遮断された際の表示用）
async function readCache(): Promise<LeagueData | null> {
  let rows: string[][];
  try { rows = await getSheetData("league_cache!A:B"); }
  catch { await ensureSheets(); rows = await getSheetData("league_cache!A:B"); }
  const row = rows[1];
  if (!row || !row[0]) return null;
  try { return JSON.parse(row[0]) as LeagueData; } catch { return null; }
}

async function writeCache(data: LeagueData): Promise<void> {
  const sheets = await getSheetsClient();
  const write = () => sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: "league_cache!A2:B2",
    valueInputOption: "RAW",
    requestBody: { values: [[JSON.stringify(data), data.fetchedAt]] },
  });
  try { await write(); }
  catch { await ensureSheets(); await write(); }
}

export async function GET() {
  const url = await getLeagueUrl();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SoccerManager/1.0)" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const html = await res.text();
    const data = parseLeagueHtml(html, url);
    await writeCache(data).catch(() => { /* 保存失敗しても表示は続行 */ });
    return NextResponse.json({ ...data, stale: false });
  } catch (e) {
    // 取得元サイトのbot対策で遮断されることがあるため、直近データにフォールバック
    const cached = await readCache().catch(() => null);
    if (cached) {
      return NextResponse.json({ ...cached, url, stale: true, fetchError: String(e) });
    }
    return NextResponse.json({ unavailable: true, url, fetchError: String(e) });
  }
}

// 取得元サイトのHTMLから戦績を更新する
async function updateFromHtml(html: string) {
  if (!html || html.length < 200) throw new Error("内容が空、または短すぎます");
  const url = await getLeagueUrl();
  const data = parseLeagueHtml(html, url);
  if (data.teams.length < 2) throw new Error("順位表・星取表を読み取れませんでした");
  await writeCache(data);
  return data;
}

// アプリ内の貼り付け欄からの更新（JSON）
export async function PUT(req: Request) {
  try {
    const { html } = (await req.json()) as { html?: string };
    const data = await updateFromHtml(html ?? "");
    return NextResponse.json({ ok: true, leagueName: data.leagueName, teams: data.teams.length, fetchedAt: data.fetchedAt });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 400 });
  }
}

// ブックマークレットからの更新（取得元サイト上で実行されるため text/plain + CORS）
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  try {
    const html = await req.text();
    const data = await updateFromHtml(html);
    return NextResponse.json(
      { ok: true, leagueName: data.leagueName, teams: data.teams.length, fetchedAt: data.fetchedAt },
      { headers: CORS }
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e instanceof Error ? e.message : e) },
      { status: 400, headers: CORS }
    );
  }
}
