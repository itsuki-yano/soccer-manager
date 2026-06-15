"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import type { Parent, Match, Driver, Practice, BucketDuty } from "@/lib/types";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${d.replace(/-/g, "/")}（${DOW[dt.getDay()]}）`;
}

type RoleItem =
  | { kind: "luggage_out"; date: string; label: string; eventName: string }
  | { kind: "bucket_bring"; date: string; label: string; eventName: string }
  | { kind: "bucket_return"; date: string; label: string; eventName: string };

export default function RolesPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [bucketDuties, setBucketDuties] = useState<BucketDuty[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedName, setSelectedName] = useState("");
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [view, setView] = useState<"list" | "cal">("list");

  useEffect(() => {
    Promise.all([
      fetch("/api/parents").then((r) => r.json()),
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
      fetch("/api/practices").then((r) => r.json()),
      fetch("/api/bucket-duties").then((r) => r.json()),
    ]).then(([prts, ms, drvs, ps, bds]) => {
      setParents(Array.isArray(prts) ? prts : []);
      setMatches(Array.isArray(ms) ? ms : []);
      setDrivers(Array.isArray(drvs) ? drvs : []);
      setPractices(Array.isArray(ps) ? ps : []);
      setBucketDuties(Array.isArray(bds) ? bds : []);
      setLoading(false);
    });
  }, []);

  function getRoles(name: string): RoleItem[] {
    const roles: RoleItem[] = [];
    const today = new Date().toISOString().slice(0, 10);

    // 荷物当番（試合の持帰り）
    matches.forEach((m) => {
      if (m.date < today) return;
      const matchDrivers = drivers.filter((d) => d.matchId === m.id);
      if (matchDrivers.some((d) => d.parentName === name)) {
        const isOut = m.equipmentBringOut?.split(",").map((s) => s.trim()).includes(name);
        if (isOut) {
          roles.push({ kind: "luggage_out", date: m.date, label: "荷物持帰り", eventName: m.matchName || `${m.matchType} ${m.venue}` });
        }
      }
      // 荷物当番（配車当番として登録）でも試合の荷物担当があれば
      const inOut = m.equipmentBringOut?.split(",").map((s) => s.trim()) ?? [];
      const inIn = m.equipmentBringIn?.split(",").map((s) => s.trim()) ?? [];
      if (inOut.includes(name)) {
        roles.push({ kind: "luggage_out", date: m.date, label: "荷物持帰り", eventName: m.matchName || `${m.matchType} ${m.venue}` });
      }
      if (inIn.includes(name) && !inOut.includes(name)) {
        roles.push({ kind: "luggage_out", date: m.date, label: "荷物持込", eventName: m.matchName || `${m.matchType} ${m.venue}` });
      }
    });

    // バケツ当番（練習）
    practices.forEach((p) => {
      if (p.date < today) return;
      const duty = bucketDuties.find((d) => d.practiceId === p.id);
      if (!duty) return;
      const practiceLabel = `${p.type} ${fmtDate(p.date)}`;
      if (duty.bringPersonName === name) {
        roles.push({ kind: "bucket_bring", date: p.date, label: "バケツ持込", eventName: practiceLabel });
      }
      if (duty.returnPersonName === name) {
        roles.push({ kind: "bucket_return", date: p.date, label: "バケツ持帰り", eventName: practiceLabel });
      }
    });

    // 重複除去・日付順
    const unique = roles.filter((r, i, arr) => arr.findIndex((x) => x.kind === r.kind && x.date === r.date) === i);
    return unique.sort((a, b) => a.date.localeCompare(b.date));
  }

  const roles = selectedName ? getRoles(selectedName) : [];
  const today = new Date().toISOString().slice(0, 10);

  // カレンダー用
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const roleMap: Record<string, RoleItem[]> = {};
  roles.forEach((r) => {
    if (!roleMap[r.date]) roleMap[r.date] = [];
    roleMap[r.date].push(r);
  });

  const kindColor = (kind: string) => {
    if (kind === "bucket_bring") return { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", badge: "bg-blue-100 text-blue-700" };
    if (kind === "bucket_return") return { bg: "bg-pink-50", border: "border-pink-200", text: "text-pink-700", badge: "bg-pink-100 text-pink-700" };
    return { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", badge: "bg-orange-100 text-orange-700" };
  };

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const sortedParents = [...parents].sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName));

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="役割予定" />

      <div className="flex gap-2 mb-4">
        <div className="flex-1">
          <select
            value={selectedName}
            onChange={(e) => setSelectedName(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
          >
            <option value="">選手を選択...</option>
            {sortedParents.map((p) => (
              <option key={p.id} value={p.playerName}>{p.playerName}</option>
            ))}
          </select>
        </div>
        <div className="flex bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
          {(["list", "cal"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
            >
              {v === "list" ? "≡" : "📅"}
            </button>
          ))}
        </div>
      </div>

      {!selectedName && (
        <div className="text-center text-gray-400 py-16">
          <div className="text-4xl mb-3">👤</div>
          <p>選手を選ぶと担当予定が表示されます</p>
        </div>
      )}

      {selectedName && roles.length === 0 && (
        <div className="text-center text-gray-400 py-16">
          <div className="text-4xl mb-3">✅</div>
          <p>{selectedName} の担当予定はありません</p>
        </div>
      )}

      {selectedName && roles.length > 0 && view === "list" && (
        <div className="grid gap-2">
          {roles.map((r, i) => {
            const c = kindColor(r.kind);
            return (
              <div key={i} className={`flex items-center gap-3 ${c.bg} border ${c.border} rounded-xl p-3`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${c.bg} border ${c.border}`}>
                  {r.kind === "bucket_bring" ? "🪣" : r.kind === "bucket_return" ? "🪣" : "🎒"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`font-semibold text-sm ${c.text}`}>{r.eventName}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{fmtDate(r.date)}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${c.badge} whitespace-nowrap`}>{r.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {selectedName && view === "cal" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-400 text-xl px-2">‹</button>
            <span className="font-semibold text-gray-800">{calYear}年{calMonth + 1}月</span>
            <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-400 text-xl px-2">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
              <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayRoles = roleMap[dateStr] ?? [];
              const isToday = dateStr === today;
              const dow = new Date(dateStr + "T00:00:00").getDay();
              return (
                <div key={day} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative ${isToday ? "bg-blue-100 font-bold text-blue-700" : dow === 0 ? "text-red-400" : dow === 6 ? "text-blue-400" : "text-gray-700"}`}>
                  {day}
                  {dayRoles.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {dayRoles.slice(0, 2).map((r, ri) => {
                        const dotColor = r.kind === "bucket_bring" ? "bg-blue-400" : r.kind === "bucket_return" ? "bg-pink-400" : "bg-orange-400";
                        return <span key={ri} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />;
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-3 justify-center flex-wrap">
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />バケツ持込</div>
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-pink-400 inline-block" />バケツ持帰</div>
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />荷物担当</div>
          </div>
          {/* 当月の役割一覧 */}
          {(() => {
            const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
            const monthRoles = roles.filter((r) => r.date.startsWith(monthStr));
            if (monthRoles.length === 0) return <p className="text-xs text-gray-400 text-center mt-4 py-2">この月の担当はありません</p>;
            return (
              <div className="mt-4 border-t border-gray-100 pt-3 grid gap-2">
                {monthRoles.map((r, i) => {
                  const c = kindColor(r.kind);
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{fmtDate(r.date)}</span>
                        <span className="text-xs text-gray-700">{r.eventName}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.badge}`}>{r.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </main>
  );
}
