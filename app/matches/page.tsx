"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  "公式戦": "bg-blue-100 text-blue-700",
  "合宿": "bg-purple-100 text-purple-700",
  "TM": "bg-green-100 text-green-700",
  "その他": "bg-gray-100 text-gray-600",
};

function fmtDate(d: string) {
  const dt = new Date(d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}（${weekdays[dt.getDay()]}）`;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("すべて");
  const [filterSettlement, setFilterSettlement] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
    ]).then(([m, d]) => {
      setMatches(Array.isArray(m) ? m : []);
      setDrivers(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = sorted.filter((m) => {
    if (filterType !== "すべて" && m.matchType !== filterType) return false;
    if (filterSettlement && !m.needsSettlement) return false;
    return true;
  });

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="試合・合宿管理" />
      <Link
        href="/matches/new"
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4 active:bg-blue-600"
      >
        ＋ 試合・合宿を追加
      </Link>

      {/* フィルター */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {["すべて", "公式戦", "合宿", "TM", "その他"].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterType === t ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="mb-4">
        <button
          onClick={() => setFilterSettlement((v) => !v)}
          className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            filterSettlement ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"
          }`}
        >
          💴 精算あり のみ
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-gray-400 py-8">該当する試合がありません</p>
      )}
      <div className="grid gap-3">
        {filtered.map((m) => {
          const matchDrivers = drivers.filter((d) => d.matchId === m.id);
          const typeColor = TYPE_COLORS[m.matchType] ?? "bg-gray-100 text-gray-600";
          return (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 block"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{m.matchType}</span>
                    {m.needsSettlement && (
                      <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">精算あり</span>
                    )}
                  </div>
                  <div className="font-bold text-gray-800">
                    {fmtDate(m.date)}{m.opponent ? ` vs ${m.opponent}` : ` ${m.matchName}`}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">{m.venue}</div>
                  {m.distanceKm > 0 && (
                    <div className="text-sm text-gray-500">{m.distanceKm}km × {m.carCount}台</div>
                  )}
                </div>
                <div className="text-right ml-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    当番 {matchDrivers.length}名
                  </span>
                </div>
              </div>
              {matchDrivers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {matchDrivers.map((d, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{d.parentName}</span>
                  ))}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </main>
  );
}
