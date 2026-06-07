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
const TYPE_DOT: Record<string, string> = {
  "公式戦": "bg-blue-500",
  "合宿": "bg-purple-500",
  "TM": "bg-green-500",
  "その他": "bg-gray-400",
};

function fmtDate(d: string) {
  const dt = new Date(d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getMonth() + 1}/${dt.getDate()}（${weekdays[dt.getDay()]}）`;
}

type BandEvent = {
  bandUid: string; date: string; matchType: string; matchName: string;
  opponent: string; venue: string; address: string;
  distanceKm: number; carCount: number; needsSettlement: boolean; isHome: boolean;
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("すべて");
  const [filterSettlement, setFilterSettlement] = useState(false);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // BAND同期
  const [bandEvents, setBandEvents] = useState<BandEvent[]>([]);
  const [bandLoading, setBandLoading] = useState(false);
  const [importing, setImporting] = useState<Set<string>>(new Set());
  const [importedUids, setImportedUids] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
    ]).then(([m, d]) => {
      const ml = Array.isArray(m) ? m : [];
      setMatches(ml);
      setDrivers(Array.isArray(d) ? d : []);
      setImportedUids(new Set(ml.map((x: Match) => x.bandUid).filter(Boolean)));
      setLoading(false);
    });
  }, []);

  async function syncBand() {
    setBandLoading(true);
    try {
      const res = await fetch("/api/band-calendar");
      const data = await res.json();
      if (Array.isArray(data)) setBandEvents(data);
      else alert("取得に失敗しました: " + (data.error ?? ""));
    } finally {
      setBandLoading(false);
    }
  }

  async function importEvent(ev: BandEvent) {
    setImporting((prev) => new Set(prev).add(ev.bandUid));
    try {
      const res = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...ev, matchName: ev.matchName, bandUid: ev.bandUid,
          equipmentBringIn: "", equipmentBringOut: "",
        }),
      });
      const data = await res.json();
      const newMatch: Match = {
        id: data.id,
        bandUid: ev.bandUid,
        date: ev.date, matchType: ev.matchType, matchName: ev.matchName,
        opponent: ev.opponent, venue: ev.venue, address: ev.address,
        distanceKm: ev.distanceKm, carCount: ev.carCount,
        needsSettlement: ev.needsSettlement,
        equipmentBringIn: data.equipmentBringIn ?? "",
        equipmentBringOut: "",
      };
      setMatches((prev) => [...prev, newMatch]);
      setImportedUids((prev) => new Set(prev).add(ev.bandUid));
    } finally {
      setImporting((prev) => { const s = new Set(prev); s.delete(ev.bandUid); return s; });
    }
  }

  async function importAll() {
    const pending = bandEvents.filter((e) => !importedUids.has(e.bandUid));
    for (const ev of pending) {
      await importEvent(ev);
    }
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const sorted = [...matches].sort((a, b) => a.date.localeCompare(b.date));
  const filtered = sorted.filter((m) => {
    if (filterType !== "すべて" && m.matchType !== filterType) return false;
    if (filterSettlement && !m.needsSettlement) return false;
    return true;
  });

  const newBandEvents = bandEvents.filter((e) => !importedUids.has(e.bandUid));

  // カレンダー計算
  const firstDay = new Date(calYear, calMonth, 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const startWeekday = firstDay.getDay();
  const matchesByDay: Record<string, Match[]> = {};
  for (const m of matches) {
    if (!m.date) continue;
    const [y, mo, d] = m.date.split("-").map(Number);
    if (y === calYear && mo - 1 === calMonth) {
      const key = m.date;
      if (!matchesByDay[key]) matchesByDay[key] = [];
      matchesByDay[key].push(m);
    }
  }
  const selectedMatches = selectedDay ? (matchesByDay[selectedDay] ?? []) : [];

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="試合・合宿管理" />

      {/* 追加 + BANDボタン */}
      <div className="flex gap-2 mb-4">
        <Link href="/matches/new"
          className="flex-1 bg-blue-500 text-white text-center py-3 rounded-xl font-semibold active:bg-blue-600">
          ＋ 追加
        </Link>
        <button onClick={syncBand} disabled={bandLoading}
          className="bg-green-500 text-white px-4 py-3 rounded-xl font-semibold disabled:opacity-60 whitespace-nowrap">
          {bandLoading ? "取得中…" : "BAND同期"}
        </button>
      </div>

      {/* BAND新着イベント */}
      {newBandEvents.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-800">
              BANDに{newBandEvents.length}件の未インポートイベント
            </span>
            <button onClick={importAll}
              className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold">
              全てインポート
            </button>
          </div>
          <div className="grid gap-2">
            {newBandEvents.map((ev) => (
              <div key={ev.bandUid} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-green-100">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">{ev.date} · <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLORS[ev.matchType] ?? "bg-gray-100 text-gray-600"}`}>{ev.matchType}</span></div>
                  <div className="text-sm font-medium text-gray-800 truncate">{ev.matchName}</div>
                  {ev.venue && <div className="text-xs text-gray-400 truncate">{ev.venue}</div>}
                  {ev.distanceKm > 0 && <div className="text-xs text-gray-400">{ev.distanceKm}km</div>}
                </div>
                <button onClick={() => importEvent(ev)} disabled={importing.has(ev.bandUid)}
                  className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 whitespace-nowrap">
                  {importing.has(ev.bandUid) ? "…" : "追加"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ビュー切り替え */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {(["list", "calendar"] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"
            }`}>
            {v === "list" ? "一覧" : "カレンダー"}
          </button>
        ))}
      </div>

      {view === "list" ? (
        <>
          {/* フィルター */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {["すべて", "公式戦", "合宿", "TM", "その他"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filterType === t ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-200"
                }`}>{t}</button>
            ))}
          </div>
          <div className="mb-4">
            <button onClick={() => setFilterSettlement((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterSettlement ? "bg-orange-500 text-white border-orange-500" : "bg-white text-gray-600 border-gray-200"
              }`}>
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
              const isHome = m.venue.includes("かりがね") || m.address.includes("かりがね");
              return (
                <Link key={m.id} href={`/matches/${m.id}`}
                  className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 block">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{m.matchType}</span>
                        {m.needsSettlement && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">精算あり</span>}
                        {isHome && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">ホーム</span>}
                        {m.bandUid && <span className="text-xs text-green-500">BAND</span>}
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
                      {!isHome && matchDrivers.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          配車当番 {matchDrivers.length}名
                        </span>
                      )}
                    </div>
                  </div>
                  {matchDrivers.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">配車当番:</div>
                      <div className="flex flex-wrap gap-1">
                        {matchDrivers.map((d, i) => (
                          <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{d.parentName}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.equipmentBringOut && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">持ち帰り当番:</div>
                      <div className="flex flex-wrap gap-1">
                        {m.equipmentBringOut.split(",").map((n, i) => (
                          <span key={i} className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      ) : (
        // カレンダービュー
        <div>
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); setSelectedDay(null); }}
              className="text-gray-500 text-xl px-3 py-1">‹</button>
            <span className="font-bold text-gray-800">{calYear}年{calMonth + 1}月</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); setSelectedDay(null); }}
              className="text-gray-500 text-xl px-3 py-1">›</button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">
            <div className="grid grid-cols-7 border-b border-gray-100">
              {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
                <div key={w} className={`text-center text-xs py-2 font-medium ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-500"}`}>{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startWeekday }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const dayMatches = matchesByDay[dateStr] ?? [];
                const isSelected = selectedDay === dateStr;
                const isToday = dateStr === new Date().toISOString().slice(0, 10);
                const weekday = (startWeekday + i) % 7;
                return (
                  <button key={day} onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={`min-h-[52px] p-1 border-t border-gray-50 text-center transition-colors ${isSelected ? "bg-blue-50" : "active:bg-gray-50"}`}>
                    <div className={`text-sm font-medium mb-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                      isToday ? "bg-blue-500 text-white" : weekday === 0 ? "text-red-400" : weekday === 6 ? "text-blue-400" : "text-gray-700"
                    }`}>{day}</div>
                    <div className="flex flex-wrap gap-0.5 justify-center">
                      {dayMatches.map((m) => (
                        <span key={m.id} className={`w-1.5 h-1.5 rounded-full ${TYPE_DOT[m.matchType] ?? "bg-gray-400"}`} />
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 凡例 */}
          <div className="flex gap-3 mb-4 flex-wrap">
            {Object.entries(TYPE_DOT).map(([type, dot]) => (
              <div key={type} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${dot}`} />
                <span className="text-xs text-gray-500">{type}</span>
              </div>
            ))}
          </div>

          {/* 選択日の試合 */}
          {selectedDay && (
            <div>
              <div className="text-sm font-medium text-gray-600 mb-2">{fmtDate(selectedDay)}</div>
              {selectedMatches.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">この日の予定はありません</p>
              ) : (
                <div className="grid gap-2">
                  {selectedMatches.map((m) => {
                    const typeColor = TYPE_COLORS[m.matchType] ?? "bg-gray-100 text-gray-600";
                    return (
                      <Link key={m.id} href={`/matches/${m.id}`}
                        className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 block">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{m.matchType}</span>
                          {m.needsSettlement && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">精算あり</span>}
                        </div>
                        <div className="font-bold text-gray-800 text-sm">{m.opponent ? `vs ${m.opponent}` : m.matchName}</div>
                        <div className="text-xs text-gray-500 mt-1">{m.venue}</div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
