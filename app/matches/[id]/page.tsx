"use client";
import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Match, Driver, Parent } from "@/lib/types";

const MATCH_TYPES = ["公式戦", "合宿", "TM", "その他"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${dt.getFullYear()}/${dt.getMonth() + 1}/${dt.getDate()}（${weekdays[dt.getDay()]}）`;
}

// 選手選択グリッド（配車当番・備品持帰り共通）
function PlayerSelector({
  parents,
  selected,
  onToggle,
  color = "blue",
}: {
  parents: Parent[];
  selected: string[];
  onToggle: (name: string) => void;
  color?: "blue" | "orange";
}) {
  const [filterGroup, setFilterGroup] = useState("全員");
  const [customName, setCustomName] = useState("");

  const groups: Record<string, Parent[]> = {};
  const noGroup: Parent[] = [];
  for (const p of parents) {
    if (p.group) {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    } else {
      noGroup.push(p);
    }
  }
  const sortedGroups = Object.keys(groups).sort();
  const filteredParents = filterGroup === "全員"
    ? parents
    : parents.filter((p) => p.group === filterGroup.replace("班", ""));

  const selBg = color === "orange" ? "bg-orange-500 text-white border-orange-500" : "bg-blue-500 text-white border-blue-500";
  const tagBg = color === "orange" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700";
  const summarybg = color === "orange" ? "bg-orange-50 border-orange-100" : "bg-blue-50 border-blue-100";
  const summaryText = color === "orange" ? "text-orange-800" : "text-blue-800";

  function addCustom() {
    if (!customName.trim()) return;
    if (!selected.includes(customName.trim())) onToggle(customName.trim());
    setCustomName("");
  }

  return (
    <div>
      {/* 班フィルター */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {["全員", "1班", "2班", "3班", "4班"].map((g) => (
          <button key={g} onClick={() => setFilterGroup(g)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              filterGroup === g ? "bg-gray-700 text-white border-gray-700" : "bg-gray-50 text-gray-600 border-gray-200"
            }`}>{g}</button>
        ))}
      </div>

      {/* 選手グリッド */}
      {filterGroup === "全員" ? (
        <>
          {sortedGroups.map((g) => (
            <div key={g} className="mb-3">
              <div className="text-xs text-gray-400 font-medium mb-1.5">{g}班</div>
              <div className="grid grid-cols-3 gap-2">
                {groups[g].map((p) => (
                  <button key={p.id} onClick={() => onToggle(p.playerName)}
                    className={`text-sm py-2 px-2 rounded-lg border text-center transition-colors ${
                      selected.includes(p.playerName) ? selBg : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}>
                    {p.playerName}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {noGroup.length > 0 && (
            <div className="mb-3">
              <div className="text-xs text-gray-400 font-medium mb-1.5">未分類</div>
              <div className="grid grid-cols-3 gap-2">
                {noGroup.map((p) => (
                  <button key={p.id} onClick={() => onToggle(p.playerName)}
                    className={`text-sm py-2 px-2 rounded-lg border text-center transition-colors ${
                      selected.includes(p.playerName) ? selBg : "bg-gray-50 text-gray-700 border-gray-200"
                    }`}>
                    {p.playerName}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {filteredParents.map((p) => (
            <button key={p.id} onClick={() => onToggle(p.playerName)}
              className={`text-sm py-2 px-2 rounded-lg border text-center transition-colors ${
                selected.includes(p.playerName) ? selBg : "bg-gray-50 text-gray-700 border-gray-200"
              }`}>
              {p.playerName}
            </button>
          ))}
        </div>
      )}

      {/* 手動追加 */}
      <div className="flex gap-2 mb-3">
        <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => { if (e.nativeEvent.isComposing) return; if (e.key === "Enter") addCustom(); }}
          placeholder="その他の名前を追加" className="input flex-1" />
        <button onClick={addCustom} className="bg-gray-200 px-3 rounded-lg text-sm">追加</button>
      </div>

      {/* 選択中サマリー */}
      {selected.length > 0 && (
        <div className={`p-3 rounded-lg border ${summarybg} mb-2`}>
          <div className={`text-sm font-medium ${summaryText} mb-1.5`}>{selected.length}名 選択中</div>
          <div className="flex flex-wrap gap-1">
            {selected.map((n) => (
              <span key={n} onClick={() => onToggle(n)}
                className={`text-xs px-2 py-1 rounded-full cursor-pointer ${tagBg}`}>
                {n} ✕
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEq, setSavingEq] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [matchType, setMatchType] = useState("公式戦");
  const [needsSettlement, setNeedsSettlement] = useState(true);
  const [form, setForm] = useState<Omit<Match, "id" | "matchType" | "needsSettlement" | "bandUid" | "equipmentBringIn" | "equipmentBringOut" | "settlementStatus" | "carCount">>({
    date: "", matchName: "", opponent: "", venue: "", address: "", distanceKm: 0,
  });
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedEquipOut, setSelectedEquipOut] = useState<string[]>([]);
  // 前回持帰り引継ぎバナー用
  const [inheritSource, setInheritSource] = useState<{ date: string; names: string[] } | null>(null);
  const [inheritDismissed, setInheritDismissed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch(`/api/drivers?matchId=${id}`).then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
    ]).then(([matches, drvs, prts]) => {
      const matchList: Match[] = Array.isArray(matches) ? matches : [];
      const drvList: Driver[] = Array.isArray(drvs) ? drvs : [];
      const prtList: Parent[] = Array.isArray(prts) ? prts : [];
      const m = matchList.find((x) => x.id === id);
      if (m) {
        setMatch(m);
        setMatchType(m.matchType ?? "公式戦");
        setNeedsSettlement(m.needsSettlement ?? false);
        setForm({ date: m.date, matchName: m.matchName, opponent: m.opponent, venue: m.venue, address: m.address, distanceKm: m.distanceKm });
        // 備品持帰りを配列に復元
        const outNames = m.equipmentBringOut ? m.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];
        setSelectedEquipOut(outNames);
      }
      setAllMatches(matchList);
      setDrivers(drvList);
      const driverNames = drvList.map((d) => d.parentName);
      setSelectedDrivers(driverNames);

      // 配車当番が未設定の場合、直前の試合の備品持帰りから引継ぎ候補を表示
      if (m && drvList.length === 0) {
        const prev = matchList
          .filter((x) => x.id !== id && x.date <= m.date && x.equipmentBringOut)
          .sort((a, b) => b.date.localeCompare(a.date))[0];
        if (prev?.equipmentBringOut) {
          const names = prev.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean);
          if (names.length > 0) setInheritSource({ date: prev.date, names });
        }
      }

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
      if (data.roundTripKm) setForm((f) => ({ ...f, distanceKm: data.roundTripKm }));
    } finally {
      setCalcLoading(false);
    }
  }

  function onAddressChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setForm((f) => ({ ...f, address: val }));
    // IME変換中（ローマ字→かな→漢字の途中）はAPI呼び出しをスキップ
    if ((e.nativeEvent as InputEvent).isComposing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => calcDistance(val), 800);
  }

  function matchBody(equipmentBringOut: string) {
    return {
      ...form,
      carCount: selectedDrivers.length,
      matchType, needsSettlement,
      bandUid: match?.bandUid ?? "",
      equipmentBringIn: match?.equipmentBringIn ?? "",
      equipmentBringOut,
      settlementStatus: match?.settlementStatus ?? "",
    };
  }

  async function saveMatch() {
    setSaving(true);
    const equipmentBringOut = selectedEquipOut.join(", ");
    await fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchBody(equipmentBringOut)),
    });
    setMatch((prev) => prev ? { ...prev, ...form, carCount: selectedDrivers.length, matchType, needsSettlement, equipmentBringOut } : prev);
    setEditing(false);
    setSaving(false);
  }

  async function saveEquipOut() {
    setSavingEq(true);
    const equipmentBringOut = selectedEquipOut.join(", ");
    await fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(matchBody(equipmentBringOut)),
    });
    setMatch((prev) => prev ? { ...prev, equipmentBringOut } : prev);
    setSavingEq(false);
    alert("備品持帰り担当を保存しました");
  }

  async function saveDrivers() {
    setSaving(true);
    const carCount = selectedDrivers.length;
    await Promise.all([
      fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: id, parentNames: selectedDrivers }),
      }),
      fetch(`/api/matches/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchBody(match?.equipmentBringOut ?? "")),
      }),
    ]);
    setDrivers(selectedDrivers.map((n) => ({ matchId: id, parentName: n })));
    setMatch((prev) => prev ? { ...prev, carCount } : prev);
    setSaving(false);
    alert("配車当番を保存しました");
  }

  async function deleteMatch() {
    await fetch(`/api/matches/${id}`, { method: "DELETE" });
    router.push("/matches");
  }

  function toggleDriver(name: string) {
    setSelectedDrivers((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  function toggleEquipOut(name: string) {
    setSelectedEquipOut((prev) => prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
  }

  function applyInherit() {
    if (!inheritSource) return;
    setSelectedDrivers(inheritSource.names);
    setInheritDismissed(true);
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;
  if (!match) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-red-400">試合が見つかりません</div>;

  const isHomeVenue = form.venue.includes("かりがね") || form.address.includes("かりがね");

  // 次の試合を探す（備品持帰り保存後の引継ぎ先案内用）
  const nextMatch = allMatches
    .filter((x) => x.id !== id && x.date >= form.date)
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="試合詳細" back="/matches" />
      {showDeleteConfirm && (
        <DeleteConfirmModal
          message={`この試合を削除しますか？\n${match ? `${match.date} ${match.opponent ? `vs ${match.opponent}` : match.matchName}` : ""}`}
          onConfirm={deleteMatch}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* 試合情報 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        {editing ? (
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">種別</label>
              <div className="grid grid-cols-4 gap-2">
                {MATCH_TYPES.map((t) => (
                  <button key={t} type="button" onClick={() => setMatchType(t)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      matchType === t ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>{t}</button>
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
            {matchType !== "合宿" && (
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
              <label className="block text-xs text-gray-500 mb-0.5">{`片道距離(km)${calcLoading ? " ⏳ 計算中..." : ""}`}</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" value={form.distanceKm} onChange={(e) => setForm((f) => ({ ...f, distanceKm: Number(e.target.value) }))} className="input flex-1" />
                {form.address && (
                  <button type="button" onClick={() => calcDistance(form.address)} disabled={calcLoading}
                    className="bg-gray-100 text-gray-600 px-3 rounded-lg text-sm whitespace-nowrap disabled:opacity-50">再計算</button>
                )}
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{match.matchType}</span>
                  {match.needsSettlement && <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">精算あり</span>}
                  {isHomeVenue && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">ホーム</span>}
                </div>
                <div className="font-bold text-gray-800 text-lg">{fmtDate(match.date)}</div>
                {match.opponent && <div className="text-blue-600 font-semibold">vs {match.opponent}</div>}
              </div>
              <button onClick={() => setEditing(true)} className="text-sm text-gray-400 border border-gray-200 px-3 py-1 rounded-lg">編集</button>
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              {match.matchName && <div>🏆 {match.matchName}</div>}
              <div>📍 {match.venue}</div>
              {match.address && <div className="text-gray-400 text-xs pl-4">{match.address}</div>}
              {match.distanceKm > 0 && <div>🚗 片道 {match.distanceKm}km × {selectedDrivers.length}台</div>}
            </div>
            <button onClick={() => setShowDeleteConfirm(true)} className="mt-4 w-full text-red-400 text-sm py-2 border border-red-100 rounded-lg">
              この試合を削除
            </button>
          </>
        )}
      </div>

      {/* 配車当番 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-bold text-gray-700">配車当番</h2>
          {isHomeVenue && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">ホーム（距離計算なし）</span>}
        </div>

        {/* 精算フラグ */}
        <button type="button" onClick={() => {
          const next = !needsSettlement;
          setNeedsSettlement(next);
          setMatch((prev) => prev ? { ...prev, needsSettlement: next } : prev);
          const equipmentBringOut = match?.equipmentBringOut ?? "";
          fetch(`/api/matches/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              carCount: selectedDrivers.length,
              matchType,
              needsSettlement: next,
              bandUid: match?.bandUid ?? "",
              equipmentBringIn: match?.equipmentBringIn ?? "",
              equipmentBringOut,
              settlementStatus: match?.settlementStatus ?? "",
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const err = await r.json().catch(() => ({}));
              alert("精算フラグの保存に失敗しました: " + (err.error ?? r.status));
              setNeedsSettlement(!next);
              setMatch((prev) => prev ? { ...prev, needsSettlement: !next } : prev);
            }
          });
        }}
          className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-colors mb-3 ${
            needsSettlement ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
          {needsSettlement ? "💴 精算あり（交通費発生）" : "精算なし"}
        </button>

        {/* 前回備品持帰りからの引継ぎバナー */}
        {inheritSource && !inheritDismissed && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3">
            <p className="text-sm text-orange-800 mb-2">
              前回（{fmtDate(inheritSource.date)}）の備品持帰り担当を引継ぎますか？
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              {inheritSource.names.map((n) => (
                <span key={n} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full">{n}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={applyInherit}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-semibold">
                この担当者を配車当番にセット
              </button>
              <button onClick={() => setInheritDismissed(true)}
                className="text-sm text-gray-400 px-3 py-2">スキップ</button>
            </div>
          </div>
        )}

        <PlayerSelector
          parents={parents}
          selected={selectedDrivers}
          onToggle={toggleDriver}
          color="blue"
        />
        {selectedDrivers.length > 0 && (() => {
          const totalCap = selectedDrivers.reduce((sum, name) => {
            const p = parents.find((x) => x.playerName === name);
            return sum + (p?.carCapacity ?? 0);
          }, 0);
          return totalCap > 0 ? (
            <div className="text-sm text-blue-700 font-medium mb-2">最大 {totalCap}人 乗車可</div>
          ) : null;
        })()}
        <button onClick={saveDrivers} disabled={saving}
          className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
          {saving ? "保存中..." : "配車当番を保存"}
        </button>
      </div>

      {/* 備品持帰り */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="font-bold text-gray-700">備品持帰り当番</h2>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          選択した担当者は次の試合の配車当番として自動引継ぎされます
          {nextMatch && <span className="text-blue-500">（次: {fmtDate(nextMatch.date)} {nextMatch.venue}）</span>}
        </p>
        <PlayerSelector
          parents={parents}
          selected={selectedEquipOut}
          onToggle={toggleEquipOut}
          color="orange"
        />
        <button onClick={saveEquipOut} disabled={savingEq}
          className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50">
          {savingEq ? "保存中..." : "備品持帰り当番を保存"}
        </button>
      </div>
    </main>
  );
}
