"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver, Parent } from "@/lib/types";

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
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Omit<Match, "id">>({
    date: "", matchName: "", opponent: "", venue: "", address: "",
    distanceKm: 0, carCount: 0, accountant: "",
  });
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [newDriver, setNewDriver] = useState("");

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
        setForm({ date: m.date, matchName: m.matchName, opponent: m.opponent, venue: m.venue, address: m.address, distanceKm: m.distanceKm, carCount: m.carCount, accountant: m.accountant });
      }
      setDrivers(drvList);
      setSelectedDrivers(drvList.map((d: Driver) => d.parentName));
      setParents(prtList);
      setLoading(false);
    });
  }, [id]);

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
            {(["date", "matchName", "opponent", "venue", "address"] as const).map((k) => (
              <div key={k}>
                <label className="block text-xs text-gray-500 mb-0.5">
                  {{ date: "試合日", matchName: "試合名", opponent: "対戦相手", venue: "会場名", address: "住所" }[k]}
                </label>
                <input
                  type={k === "date" ? "date" : "text"}
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                  className="input"
                />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">往復距離(km)</label>
                <input type="number" step="0.01" value={form.distanceKm} onChange={(e) => setForm((f) => ({ ...f, distanceKm: Number(e.target.value) }))} className="input" />
              </div>
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
                <div className="text-blue-600 font-semibold">vs {match.opponent}</div>
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
              onClick={() => toggleDriver(p.parentName)}
              className={`text-sm py-2 px-3 rounded-lg border text-left transition-colors ${
                selectedDrivers.includes(p.parentName)
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-gray-50 text-gray-700 border-gray-200"
              }`}
            >
              {p.parentName}
              <span className="block text-xs opacity-70">{p.playerName}</span>
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
