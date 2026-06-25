"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver, Parent } from "@/lib/types";

const TYPE_COLORS: Record<string, string> = {
  "公式戦": "bg-stone-100 text-stone-700",
  "合宿": "bg-amber-100 text-amber-800",
  "TM": "bg-emerald-100 text-emerald-800",
  "その他": "bg-gray-100 text-gray-600",
};
const TYPE_DOT: Record<string, string> = {
  "公式戦": "bg-stone-700",
  "合宿": "bg-amber-600",
  "TM": "bg-emerald-700",
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
  const [parents, setParents] = useState<Parent[]>([]);
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
  const [zeroDistanceAlert, setZeroDistanceAlert] = useState<{ matchId: string; matchName: string } | null>(null);
  // BANDで削除された予定（アプリからも削除する候補）
  const [pendingDeletes, setPendingDeletes] = useState<Match[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
    ]).then(([m, d, p]) => {
      const ml = Array.isArray(m) ? m : [];
      setMatches(ml);
      setDrivers(Array.isArray(d) ? d : []);
      setParents(Array.isArray(p) ? p : []);
      setImportedUids(new Set(ml.map((x: Match) => x.bandUid).filter(Boolean)));
      setLoading(false);
    });
  }, []);

  async function syncBand() {
    setBandLoading(true);
    try {
      const res = await fetch("/api/band-calendar");
      const data = await res.json();
      if (Array.isArray(data)) {
        setBandEvents(data);
        // BAND側で削除された予定を検出（BAND由来かつ未来の予定で、最新フィードに存在しないもの）
        const feedUids = new Set<string>(data.map((e: BandEvent) => e.bandUid));
        const today = new Date().toISOString().slice(0, 10);
        const bandLinkedFuture = matches.filter((m) => m.bandUid && m.date >= today);
        const gone = bandLinkedFuture.filter((m) => !feedUids.has(m.bandUid));
        setPendingDeletes(gone);
        setSyncSummary(`BAND取得${data.length}件／アプリのBAND予定(未来)${bandLinkedFuture.length}件／削除候補${gone.length}件`);
      } else {
        alert("取得に失敗しました: " + (data.error ?? ""));
      }
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
        settlementStatus: "",
        skippedDrivers: "",
        bandUrl1: "",
        bandUrl2: "",
      };
      setMatches((prev) => [...prev, newMatch]);
      setImportedUids((prev) => new Set(prev).add(ev.bandUid));
      // 距離0km（ホームでない）なら警告
      if (ev.distanceKm === 0 && !ev.isHome) {
        setZeroDistanceAlert({ matchId: data.id, matchName: ev.matchName });
      }
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

  // BANDで削除された予定をアプリからも削除（紐付く配車当番も連動削除）
  async function confirmDeletes() {
    setDeleting(true);
    try {
      for (const m of pendingDeletes) {
        // 配車当番(drivers)をクリア（備品持帰りはmatchの項目なので削除で消える）
        await fetch("/api/drivers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: m.id, parentNames: [] }),
        });
        await fetch(`/api/matches/${m.id}`, { method: "DELETE" });
      }
      const goneIds = new Set(pendingDeletes.map((m) => m.id));
      const goneUids = new Set(pendingDeletes.map((m) => m.bandUid).filter(Boolean));
      setMatches((prev) => prev.filter((m) => !goneIds.has(m.id)));
      setImportedUids((prev) => { const s = new Set(prev); goneUids.forEach((u) => s.delete(u)); return s; });
      setPendingDeletes([]);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

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
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="試合・合宿管理" />

      {/* BAND削除予定の連動削除モーダル */}
      {pendingDeletes.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="text-center mb-3">
              <div className="text-4xl mb-2">🗑️</div>
              <h2 className="text-lg font-bold text-gray-800">BANDで削除された予定</h2>
              <p className="text-sm text-gray-600 mt-2">
                以下の{pendingDeletes.length}件はBAND側で削除されています。<br />
                アプリからも削除しますか？<br />
                <span className="text-xs text-gray-400">（紐付く配車当番・備品持帰りも一緒に削除されます）</span>
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2 mb-4 space-y-1">
              {pendingDeletes.map((m) => (
                <div key={m.id} className="text-sm text-gray-700">
                  <span className="text-gray-400">{fmtDate(m.date)}</span>　{m.matchName || m.matchType}{m.opponent ? ` vs ${m.opponent}` : ""}
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <button
                onClick={confirmDeletes}
                disabled={deleting}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {deleting ? "削除中..." : `${pendingDeletes.length}件を削除する`}
              </button>
              <button onClick={() => setPendingDeletes([])} disabled={deleting} className="w-full text-gray-500 py-2 text-sm">
                削除しない（残す）
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 距離0km警告モーダル */}
      {zeroDistanceAlert && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="text-center mb-4">
              <div className="text-4xl mb-2">⚠️</div>
              <h2 className="text-lg font-bold text-gray-800">距離が0kmです</h2>
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-semibold">{zeroDistanceAlert.matchName}</span>
                の距離を自動計算できませんでした。<br />
                住所を確認・入力して距離を再計算してください。
              </p>
            </div>
            <div className="grid gap-2">
              <a
                href={`/matches/${zeroDistanceAlert.matchId}`}
                className="block w-full text-center bg-amber-600 text-white py-3 rounded-xl font-semibold"
                onClick={() => setZeroDistanceAlert(null)}
              >
                編集画面を開く
              </a>
              <button
                onClick={() => setZeroDistanceAlert(null)}
                className="w-full text-gray-500 py-2 text-sm"
              >
                後で確認する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 追加 + BANDボタン */}
      <div className="flex gap-2 mb-4">
        <button onClick={syncBand} disabled={bandLoading}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
          {bandLoading ? "取得中…" : "🎵 BAND予定取込み"}
        </button>
        <Link href="/matches/new"
          className="flex-1 bg-stone-700 text-white text-center py-2.5 rounded-xl text-sm font-semibold active:bg-stone-800 flex items-center justify-center">
          ＋ 手動追加
        </Link>
      </div>

      {syncSummary && (
        <div className="mb-4 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          {syncSummary}
        </div>
      )}

      {/* BAND新着イベント */}
      {newBandEvents.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-emerald-800">
              BANDに{newBandEvents.length}件の未インポートイベント
            </span>
            <button onClick={importAll}
              className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold">
              全てインポート
            </button>
          </div>
          <div className="grid gap-2">
            {newBandEvents.map((ev) => (
              <div key={ev.bandUid} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-emerald-100">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-500">{ev.date} · <span className={`px-1.5 py-0.5 rounded text-xs ${TYPE_COLORS[ev.matchType] ?? "bg-gray-100 text-gray-600"}`}>{ev.matchType}</span></div>
                  <div className="text-sm font-medium text-gray-800 truncate">{ev.matchName}</div>
                  {ev.venue && <div className="text-xs text-gray-400 truncate">{ev.venue}</div>}
                  {ev.distanceKm > 0
                    ? <div className="text-xs text-gray-400">{ev.distanceKm}km（往復）</div>
                    : !ev.isHome && (
                      <div className="text-xs text-amber-700 font-medium flex items-center gap-1">
                        ⚠️ 距離0km・住所要確認
                      </div>
                    )
                  }
                </div>
                <button onClick={() => importEvent(ev)} disabled={importing.has(ev.bandUid)}
                  className="text-xs bg-stone-700 text-white px-3 py-1.5 rounded-lg disabled:opacity-50 whitespace-nowrap">
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
            {["すべて", "公式戦", "TM", "その他", "合宿"].map((t) => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  filterType === t ? "bg-stone-700 text-white border-stone-700" : "bg-white text-gray-600 border-gray-200"
                }`}>{t}</button>
            ))}
          </div>
          <div className="mb-4">
            <button onClick={() => setFilterSettlement((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                filterSettlement ? "bg-amber-600 text-white border-amber-600" : "bg-white text-gray-600 border-gray-200"
              }`}>
              💴 精算あり のみ
            </button>
          </div>

          {filtered.length === 0 && (
            <p className="text-center text-gray-400 py-8">該当する試合がありません</p>
          )}
          {(() => {
            const today = new Date().toISOString().slice(0, 10);
            const upcoming = filtered.filter((m) => m.date >= today);
            const past = filtered.filter((m) => m.date < today).reverse();

            const normN = (s: string) => s.replace(/[\s　]/g, "");
            function MatchCard({ m }: { m: Match }) {
              const matchDrivers = drivers.filter((d) => d.matchId === m.id);
              const totalCapacity = matchDrivers.reduce((sum, d) => {
                const p = parents.find((px) => normN(px.playerName) === normN(d.parentName));
                return sum + (p?.carCapacity ?? 0);
              }, 0);
              const typeColor = TYPE_COLORS[m.matchType] ?? "bg-gray-100 text-gray-600";
              const isHome = m.venue.includes("かりがね") || m.address.includes("かりがね");
              const isPast = m.date < today;
              return (
                <Link href={`/matches/${m.id}`}
                  className={`rounded-xl p-4 shadow-sm border block ${isPast ? "bg-gray-50 border-gray-100 opacity-75" : "bg-white border-gray-100"}`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{m.matchType}</span>
                        {m.needsSettlement && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">精算あり</span>}
                        {isHome && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">ホーム</span>}
                        {m.bandUid && <span className="text-xs text-emerald-700">BAND</span>}
                      </div>
                      <div className={`font-bold ${isPast ? "text-gray-500" : "text-gray-800"}`}>
                        {fmtDate(m.date)}{m.opponent ? ` vs ${m.opponent}` : ` ${m.matchName}`}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">{m.venue}</div>
                      {m.distanceKm > 0 && (
                        <div className="text-sm text-gray-500">往復 {m.distanceKm}km × {m.carCount}台</div>
                      )}
                    </div>
                    <div className="text-right ml-2 flex-shrink-0">
                      {!isHome && matchDrivers.length > 0 && (
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">
                            配車当番 {matchDrivers.length}名
                          </span>
                          {totalCapacity > 0 && (
                            <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full whitespace-nowrap">
                              乗車可能 {totalCapacity}名
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  {matchDrivers.length > 0 && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">配車当番:</div>
                      <div className="flex flex-wrap gap-1">
                        {matchDrivers.map((d, i) => (
                          <span key={i} className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">{d.parentName}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.equipmentBringOut && (
                    <div className="mt-2">
                      <div className="text-xs text-gray-400 mb-1">持ち帰り当番:</div>
                      <div className="flex flex-wrap gap-1">
                        {m.equipmentBringOut.split(",").map((n, i) => (
                          <span key={i} className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full">{n.trim()}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Link>
              );
            }

            return (
              <div className="grid gap-4">
                {upcoming.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-stone-700">今後の予定</span>
                      <span className="text-xs text-gray-400">{upcoming.length}件</span>
                    </div>
                    <div className="grid gap-3">
                      {upcoming.map((m) => <MatchCard key={m.id} m={m} />)}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold text-gray-400">過去の試合</span>
                      <span className="text-xs text-gray-400">{past.length}件</span>
                    </div>
                    <div className="grid gap-3">
                      {past.map((m) => <MatchCard key={m.id} m={m} />)}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
                <div key={w} className={`text-center text-xs py-2 font-medium ${i === 0 ? "text-red-400" : i === 6 ? "text-stone-500" : "text-gray-500"}`}>{w}</div>
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
                    className={`min-h-[52px] p-1 border-t border-gray-50 text-center transition-colors ${isSelected ? "bg-stone-50" : "active:bg-gray-50"}`}>
                    <div className={`text-sm font-medium mb-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${
                      isToday ? "bg-stone-700 text-white" : weekday === 0 ? "text-red-400" : weekday === 6 ? "text-stone-500" : "text-gray-700"
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

          {/* その月の予定一覧 */}
          {(() => {
            const monthMatches = Object.values(matchesByDay).flat().sort((a, b) => a.date.localeCompare(b.date));
            if (monthMatches.length === 0) {
              return <p className="text-center text-gray-400 py-6 text-sm">{calYear}年{calMonth + 1}月の予定はありません</p>;
            }
            return (
              <div>
                <div className="text-sm font-bold text-gray-600 mb-2">{calYear}年{calMonth + 1}月の予定 ({monthMatches.length}件)</div>
                <div className="grid gap-2">
                  {monthMatches.map((m) => {
                    const typeColor = TYPE_COLORS[m.matchType] ?? "bg-gray-100 text-gray-600";
                    const matchDrivers = drivers.filter((d) => d.matchId === m.id);
                    const today = new Date().toISOString().slice(0, 10);
                    const isPast = m.date < today;
                    return (
                      <Link key={m.id} href={`/matches/${m.id}`}
                        className={`rounded-xl p-3 shadow-sm border block ${isPast ? "bg-gray-50 border-gray-100 opacity-75" : "bg-white border-gray-100"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeColor}`}>{m.matchType}</span>
                              {m.needsSettlement && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">精算あり</span>}
                              {isPast && <span className="text-xs text-gray-400">終了</span>}
                            </div>
                            <div className={`font-bold text-sm ${isPast ? "text-gray-500" : "text-gray-800"}`}>
                              {fmtDate(m.date)}{m.opponent ? ` vs ${m.opponent}` : ` ${m.matchName}`}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">{m.venue}</div>
                          </div>
                          {matchDrivers.length > 0 && (
                            <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full flex-shrink-0">
                              配車 {matchDrivers.length}名
                            </span>
                          )}
                        </div>
                        {matchDrivers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {matchDrivers.map((d, i) => (
                              <span key={i} className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">{d.parentName}</span>
                            ))}
                          </div>
                        )}
                        {m.equipmentBringOut && (
                          <div className="mt-1.5">
                            <span className="text-xs text-gray-400">持ち帰り: </span>
                            {m.equipmentBringOut.split(",").map((n, i) => (
                              <span key={i} className="text-xs bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full mr-1">{n.trim()}</span>
                            ))}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </main>
  );
}
