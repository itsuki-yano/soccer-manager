"use client";
import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver, Parent } from "@/lib/types";

const MATCH_TYPES = ["公式戦", "合宿", "TM", "その他"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}（${weekdays[dt.getDay()]}）`;
}

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Omit<Match, "id">>({
    date: "", matchType: "公式戦", matchName: "", opponent: "", venue: "", address: "",
    distanceKm: 0, carCount: 0,
  });
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [newDriver, setNewDriver] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch(`/api/drivers?matchId=${id}`).then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
    ]).then(([matches, drvs, prts]) => {
      const matchList = Array.isArray(matches) ? matches : [];
      const drvList = Array.isArray(drvs) ? drvs : [];
      const prtList = Array.isArray(prts) ? prts : [];
      const m = matchList.find((x: Match) => x.id === id);
      if (m) {
        setMatch(m);
        setForm({
          date: m.date, matchType: m.matchType ?? "公式戦", matchName: m.matchName,
          opponent: m.opponent, venue: m.venue, address: m.address,
          distanceKm: m.distanceKm, carCount: m.carCount,
        });
      }
      setDrivers(drvList);
      setSelectedDrivers(drvList.map((d: Driver) => d.parentName));
      setParents(prtList);
      setLoading(false);
    });
  }, [id]);

  async function calcDistance(address: string) {
    if (!address.trim()) return;
    setCalcLoading(true);
    try {
      const res = await fetch(`/api/distance?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.roundTripKm) {
        setForm((f) => ({ ...f, distanceKm: data.roundTripKm }));
      }
    } finally {
      setCalcLoading(false);
    }
  }

  function onAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setForm((f) => ({ ...f, address: val }));
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => calcDistance(val), 800);
  }

  async function saveMatch() {
    setSaving(true);
    await fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setMatch({ id, ...form });
    setEditing(false);
    setSaving(false);
  }

  async function saveDrivers() {
    setSaving(true);
    await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, parentNames: selectedDrivers }),
    });
    setDrivers(selectedDrivers.map((n) => ({ matchId: id, parentName: n })));
    setSaving(false);
    alert("配車当番を保存しました");
  }

  async function deleteMatch() {
    if (!confirm("この試合を削除しますか？")) return;
    await fetch(`/api/matches/${id}`, { method: "DELETE" });
    router.push("/matches");
  }

  function toggleDriver(name: string) {
    setSelectedDrivers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  }

  function addCustomDriver() {
    if (!newDriver.trim()) return;
    if (!selectedDrivers.includes(newDriver.trim())) {
      setSelectedDrivers((prev) => [...prev, newDriver.trim()]);
    }
    setNewDriver("");
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;
  if (!match) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-red-400">試合が見つかりません</div>;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="試合詳細" back="/matches" />

      {/* 試合情報 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        {editing ? (
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">種別</label>
              <div className="grid grid-cols-4 gap-2">
                {MATCH_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, matchType: t }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.matchType === t
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">試合日</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">試合名</label>
              <input type="text" value={form.matchName} onChange={(e) => setForm((f) => ({ ...f, matchName: e.target.value }))} className="input" />
            </div>
            {form.matchType !== "合宿" && (
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">対戦相手</label>
                <input type="text" value={form.opponent} onChange={(e) => setForm((f) => ({ ...f, opponent: e.target.value }))} className="input" />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">会場名</label>
              <input type="text" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">会場住所（入力で距離を自動計算）</label>
              <input type="text" value={form.address} onChange={onAddressChange} placeholder="例: 愛知県豊田市若林東町広間64" className="input" />
              <p className="text-xs text-gray-400 mt-1">出発地: かりがね小学校（刈谷市）</p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{`往復距離(km)${calcLoading ? " ⏳ 計算中..." : ""}`}</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" value={form.distanceKm} onChange={(e) => setForm((f) => ({ ...f, distanceKm: Number(e.target.value) }))} className="input flex-1" />
                {form.address && (
                  <button type="button" onClick={() => calcDistance(form.address)} disabled={calcLoading}
                    className="bg-gray-100 text-gray-600 px-3 rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                    再計算
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">配車台数</label>
                <input type="number" value={form.carCount} onChange={(e) => setForm((f) => ({ ...f, carCount: Number(e.target.value) }))} className="input" />
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={saveMatch} disabled={saving} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-semibold">
                キャンセル
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="font-bold text-gray-800 text-lg">{fmtDate(match.date)}</div>
                {match.matchType && match.matchType !== "公式戦" && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{match.matchType}</span>
                )}
                {match.opponent && <div className="text-blue-600 font-semibold">vs {match.opponent}</div>}
              </div>
              <button onClick={() => setEditing(true)} className="text-sm text-gray-400 border border-gray-200 px-3 py-1 rounded-lg">編集</button>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              {match.matchName && <div>🏆 {match.matchName}</div>}
              <div>📍 {match.venue}</div>
              {match.address && <div className="text-gray-400 text-xs pl-4">{match.address}</div>}
              <div>🚗 往復 {match.distanceKm}km × {match.carCount}台</div>
            </div>
            <button onClick={deleteMatch} className="mt-4 w-full text-red-400 text-sm py-2 border border-red-100 rounded-lg">
              この試合を削除
            </button>
          </>
        )}
      </div>

      {/* 配車当番 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <h2 className="font-bold text-gray-700 mb-3">配車当番</h2>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {parents.map((p) => (
            <button
              key={p.id}
              onClick={() => toggleDriver(p.playerName)}
              className={`text-sm py-2 px-3 rounded-lg border text-left transition-colors ${
                selectedDrivers.includes(p.playerName)
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              {p.playerName}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newDriver}
            onChange={(e) => setNewDriver(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomDriver()}
            placeholder="その他の保護者名"
            className="input flex-1"
          />
          <button onClick={addCustomDriver} className="bg-gray-200 px-3 rounded-lg text-sm">追加</button>
        </div>
        {selectedDrivers.length > 0 && (
          <div className="mb-3">
            <div className="text-xs text-gray-500 mb-1">選択中:</div>
            <div className="flex flex-wrap gap-1">
              {selectedDrivers.map((n) => (
                <span key={n} onClick={() => toggleDriver(n)} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full cursor-pointer">
                  {n} ✕
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          onClick={saveDrivers}
          disabled={saving}
          className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {saving ? "保存中..." : "当番を保存"}
        </button>
      </div>
    </main>
  );
}
