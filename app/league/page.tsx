"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";

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

export default function LeaguePage() {
  const [data, setData] = useState<LeagueData | null>(null);
  const [myTeam, setMyTeam] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/league").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()).catch(() => ({})),
    ]).then(([d, s]) => {
      if (d.error) setError(d.error);
      else setData(d);
      setMyTeam(s?.teamName ?? "");
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

      {!loading && error && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-3xl mb-2">⚠️</div>
          <p className="text-sm">戦績の取得に失敗しました</p>
          <p className="text-xs text-gray-400 mt-1">{error}</p>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="mb-4">
            <h2 className="font-bold text-gray-800">{data.leagueName}</h2>
            <a href={data.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-700">元データ（少年サッカー応援団）›</a>
          </div>

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

          <p className="text-xs text-gray-300 text-center mt-4">取得: {new Date(data.fetchedAt).toLocaleString("ja-JP")}</p>
        </>
      )}
    </main>
  );
}
