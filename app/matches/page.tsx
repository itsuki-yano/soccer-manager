"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver } from "@/lib/types";

function fmtDate(d: string) {
  const dt = new Date(d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}（${weekdays[dt.getDay()]}）`;
}

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="公式戦管理" />
      <Link
        href="/matches/new"
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4 active:bg-blue-600"
      >
        ＋ 試合を追加
      </Link>
      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-8">試合が登録されていません</p>
      )}
      <div className="grid gap-3">
        {sorted.map((m) => {
          const matchDrivers = drivers.filter((d) => d.matchId === m.id);
          return (
            <Link
              key={m.id}
              href={`/matches/${m.id}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 block"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-bold text-gray-800">{fmtDate(m.date)} vs{m.opponent}</div>
                  <div className="text-sm text-gray-500 mt-1">{m.venue}</div>
                  <div className="text-sm text-gray-500">{m.distanceKm}km × {m.carCount}台</div>
                </div>
                <div className="text-right">
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
