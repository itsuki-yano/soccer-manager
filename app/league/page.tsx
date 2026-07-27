"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import { VIEW_ONLY } from "@/lib/viewOnly";

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
  stale?: boolean;      // 取得元サイトから取れず、直近データを表示している
  unavailable?: boolean; // 取得元サイトから取れず、直近データも無い
};

const SOURCE_URL = "https://junior-soccer.jp/sp/tokai/aichi/league/table/163446";

export default function LeaguePage() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [myTeam, setMyTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState<{ url: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/league").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([d, s]) => {
      if (d.unavailable || d.error) setUnavailable({ url: d.url ?? SOURCE_URL });
      else setData(d);
      setMyTeam(s?.teamName ?? "");
      setLoading(false);
    }).catch(() => {
      setUnavailable({ url: SOURCE_URL });
      setLoading(false);
    });
  }, []);

  function isMine(name: string): boolean {
    if (!name) return false;
    const token = myTeam.split(/[\s　]/)[0];
    return Boolean(token && (name.includes(token) || token.includes(name)));
  }

  // 星取表セルの色分け
  function cellClass(cell: string): string {
    if (!cell || cell === "-") return "text-gray-300";
    if (cell.includes("○")) return "text-emerald-700";
    if (cell.includes("●")) return "text-red-500";
    if (cell.includes("△")) return "text-amber-600";
    return "text-gray-600";
  }

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="リーグ戦戦績" />

      {loading && <div className="text-center text-gray-400 py-12">読み込み中...</div>}

      {!loading && unavailable && (
        <div className="text-center text-gray-500 py-10">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-sm font-semibold text-gray-700">戦績を取得できませんでした</p>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed">
            元サイト（少年サッカー応援団）がアプリからの自動取得を<br />
            受け付けなくなったためです。下のリンクから直接ご確認ください。
          </p>
          <div className="flex flex-col items-center gap-2 mt-4">
            <a
              href={unavailable.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white bg-emerald-700 px-4 py-2 rounded-xl font-medium"
            >
              少年サッカー応援団で見る ›
            </a>
            {!VIEW_ONLY && (
              <Link href="/league/update" className="text-xs text-stone-700 border border-stone-300 px-3 py-1.5 rounded-lg font-medium">
                🔄 戦績を手動で更新する
              </Link>
            )}
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="mb-4 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="font-bold text-gray-800">{data.leagueName}</h2>
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700">元データ（少年サッカー応援団）›</a>
            </div>
            {!VIEW_ONLY && (
              <Link href="/league/update" className="shrink-0 text-xs text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-1.5 rounded-lg font-medium">
                🔄 更新
              </Link>
            )}
          </div>

          {data.stale && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4 text-xs text-amber-800 leading-relaxed">
              <span className="font-bold">⚠️ 最新ではない可能性があります　</span>
              元サイトが自動取得を受け付けないため、
              <b>{new Date(data.fetchedAt).toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}時点</b>
              の内容を表示しています。最新は
              <a href={data.url} target="_blank" rel="noopener noreferrer" className="underline font-medium">元サイト</a>
              でご確認ください。
            </div>
          )}

          {/* 順位表 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden mb-5">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600">📊 順位表</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-2 px-2 text-left font-medium">順</th>
                    <th className="py-2 px-2 text-left font-medium">チーム</th>
                    <th className="py-2 px-1 text-center font-medium">試</th>
                    <th className="py-2 px-1 text-center font-medium">勝</th>
                    <th className="py-2 px-1 text-center font-medium">分</th>
                    <th className="py-2 px-1 text-center font-medium">負</th>
                    <th className="py-2 px-1 text-center font-medium">得</th>
                    <th className="py-2 px-1 text-center font-medium">失</th>
                    <th className="py-2 px-1 text-center font-medium">差</th>
                    <th className="py-2 px-2 text-center font-bold text-gray-600">点</th>
                  </tr>
                </thead>
                <tbody>
                  {data.standings.map((s) => (
                    <tr key={s.name} className={`border-b border-gray-50 last:border-0 ${isMine(s.name) ? "bg-amber-50 font-semibold" : ""}`}>
                      <td className="py-2 px-2 text-gray-500">{s.rank}</td>
                      <td className="py-2 px-2 whitespace-nowrap text-gray-800">{s.name}</td>
                      <td className="py-2 px-1 text-center text-gray-500">{s.played}</td>
                      <td className="py-2 px-1 text-center text-gray-600">{s.win}</td>
                      <td className="py-2 px-1 text-center text-gray-600">{s.draw}</td>
                      <td className="py-2 px-1 text-center text-gray-600">{s.loss}</td>
                      <td className="py-2 px-1 text-center text-gray-500">{s.gf}</td>
                      <td className="py-2 px-1 text-center text-gray-500">{s.ga}</td>
                      <td className="py-2 px-1 text-center text-gray-500">{s.gd > 0 ? `+${s.gd}` : s.gd}</td>
                      <td className="py-2 px-2 text-center font-bold text-gray-800">{s.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 星取表 */}
          {data.teams.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                <span className="text-xs font-semibold text-gray-600">⚔️ 星取表（自スコア-結果-相手）</span>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr className="text-gray-400">
                      <th className="py-2 px-2 text-left sticky left-0 bg-white"></th>
                      {data.teams.map((t) => (
                        <th key={t} className="py-2 px-2 font-medium whitespace-nowrap">{t}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.matrix.map((row, i) => {
                      const rowTeam = data.teams[i] ?? "";
                      return (
                        <tr key={i} className="border-t border-gray-50">
                          <td className={`py-2 px-2 whitespace-nowrap sticky left-0 bg-white font-medium ${isMine(rowTeam) ? "text-amber-700" : "text-gray-600"}`}>{rowTeam}</td>
                          {row.map((cell, j) => (
                            <td key={j} className={`py-2 px-2 text-center whitespace-nowrap ${i === j ? "bg-gray-100" : cellClass(cell)}`}>
                              {i === j ? "—" : (cell || "")}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-300 text-center mt-4">
            {data.stale ? "データ時点" : "取得"}: {new Date(data.fetchedAt).toLocaleString("ja-JP")}
          </p>
        </>
      )}
    </main>
  );
}
