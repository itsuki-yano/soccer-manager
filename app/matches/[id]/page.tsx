"use client";
import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Match, Driver, Parent } from "@/lib/types";
import { VIEW_ONLY } from "@/lib/viewOnly";

const MATCH_TYPES = ["公式戦", "TM", "その他", "合宿"];

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [matchType, setMatchType] = useState("公式戦");
  const [needsSettlement, setNeedsSettlement] = useState(true);
  const [form, setForm] = useState<Omit<Match, "id" | "matchType" | "needsSettlement" | "bandUid" | "equipmentBringIn" | "equipmentBringOut" | "settlementStatus" | "carCount" | "skippedDrivers">>({
    date: "", matchName: "", opponent: "", venue: "", address: "", distanceKm: 0, bandUrl1: "", bandUrl2: "", startTime: "", endTime: "",
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches`).then((r) => r.json()),
      fetch(`/api/drivers?matchId=${id}`).then((r) => r.json()),
    ]).then(([matches, drvs]) => {
      const matchList: Match[] = Array.isArray(matches) ? matches : [];
      const drvList: Driver[] = Array.isArray(drvs) ? drvs : [];
      const m = matchList.find((x) => x.id === id);
      if (m) {
        setMatch(m);
        setMatchType(m.matchType ?? "公式戦");
        setNeedsSettlement(m.needsSettlement ?? false);
        const toTime = (s: string) => { const mm = (s ?? "").trim().match(/^(\d{1,2}):(\d{2})/); return mm ? `${mm[1].padStart(2, "0")}:${mm[2]}` : ""; };
        setForm({ date: m.date, matchName: m.matchName, opponent: m.opponent, venue: m.venue, address: m.address, distanceKm: m.distanceKm, bandUrl1: m.bandUrl1 ?? "", bandUrl2: m.bandUrl2 ?? "", startTime: toTime(m.startTime), endTime: toTime(m.endTime) });
      }
      setDrivers(drvList);
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
    if ((e.nativeEvent as InputEvent).isComposing) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => calcDistance(val), 800);
  }

  async function saveMatch() {
    setSaving(true);
    await fetch(`/api/matches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        carCount: drivers.length,
        matchType, needsSettlement,
        bandUid: match?.bandUid ?? "",
        equipmentBringIn: match?.equipmentBringIn ?? "",
        equipmentBringOut: match?.equipmentBringOut ?? "",
        settlementStatus: match?.settlementStatus ?? "",
      }),
    });
    setMatch((prev) => prev ? { ...prev, ...form, carCount: drivers.length, matchType, needsSettlement } : prev);
    setEditing(false);
    setSaving(false);
  }

  async function deleteMatch() {
    // 紐付く配車当番(drivers)を解除してから試合を削除（備品持帰りはmatch項目なので削除で消える）
    await fetch("/api/drivers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId: id, parentNames: [] }),
    });
    await fetch(`/api/matches/${id}`, { method: "DELETE" });
    router.push("/matches");
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;
  if (!match) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-red-400">試合が見つかりません</div>;

  const isHomeVenue = form.venue.includes("かりがね") || form.address.includes("かりがね");
  const equipOutNames = match.equipmentBringOut ? match.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];

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
                      matchType === t ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">精算</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ label: "精算あり", value: true }, { label: "精算なし", value: false }].map(({ label, value }) => (
                  <button key={label} type="button" onClick={() => setNeedsSettlement(value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      needsSettlement === value ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>{label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">試合日</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">開始時刻</label>
                <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="input" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-0.5">終了時刻</label>
                <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="input" />
              </div>
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
              <label className="block text-xs text-gray-500 mb-0.5">{`往復距離(km)${calcLoading ? " ⏳ 計算中..." : ""}`}</label>
              <div className="flex gap-2">
                <input type="number" step="0.01" value={form.distanceKm} onChange={(e) => setForm((f) => ({ ...f, distanceKm: Number(e.target.value) }))} className="input flex-1" />
                {form.address && (
                  <button type="button" onClick={() => calcDistance(form.address)} disabled={calcLoading}
                    className="bg-gray-100 text-gray-600 px-3 rounded-lg text-sm whitespace-nowrap disabled:opacity-50">再計算</button>
                )}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">BAND投稿リンク1</label>
              <input type="url" value={form.bandUrl1} onChange={(e) => setForm((f) => ({ ...f, bandUrl1: e.target.value }))} placeholder="https://band.us/..." className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">BAND投稿リンク2</label>
              <input type="url" value={form.bandUrl2} onChange={(e) => setForm((f) => ({ ...f, bandUrl2: e.target.value }))} placeholder="https://band.us/..." className="input" />
            </div>
            <div className="flex gap-2 mt-2">
              <button onClick={saveMatch} disabled={saving} className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
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
                  <span className="text-xs bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full">{match.matchType}</span>
                  {match.needsSettlement && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">精算あり</span>}
                  {isHomeVenue && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">ホーム</span>}
                </div>
                <div className="font-bold text-gray-800 text-lg">{fmtDate(match.date)}</div>
                {match.opponent && <div className="text-stone-700 font-semibold">vs {match.opponent}</div>}
              </div>
              {!VIEW_ONLY && <button onClick={() => setEditing(true)} className="text-sm text-gray-400 border border-gray-200 px-3 py-1 rounded-lg">編集</button>}
            </div>
            <div className="space-y-1 text-sm text-gray-600">
              {match.matchName && <div>🏆 {match.matchName}</div>}
              {match.startTime && <div>🕐 {match.startTime}{match.endTime ? `〜${match.endTime}` : ""}</div>}
              <div>📍 {match.venue}</div>
              {match.address && <div className="text-gray-400 text-xs pl-4">{match.address}</div>}
              {match.distanceKm > 0 && <div>🚗 往復 {match.distanceKm}km × {drivers.length}台</div>}
              {(match.bandUrl1 || match.bandUrl2) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {match.bandUrl1 && (
                    <a href={match.bandUrl1} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">🎵 BAND投稿1 ›</a>
                  )}
                  {match.bandUrl2 && (
                    <a href={match.bandUrl2} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">🎵 BAND投稿2 ›</a>
                  )}
                </div>
              )}
            </div>
            {!VIEW_ONLY && (
              <button onClick={() => setShowDeleteConfirm(true)} className="mt-4 w-full text-red-400 text-sm py-2 border border-red-100 rounded-lg">
                この試合を削除
              </button>
            )}
          </>
        )}
      </div>

      {/* 配車当番（読み取り専用） */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-gray-700">配車当番</h2>
            {match.needsSettlement && <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">💴 精算あり</span>}
          </div>
          {!VIEW_ONLY && (
            <Link href={`/duty-roster?matchId=${id}`}
              className="text-sm text-stone-700 border border-stone-200 px-3 py-1 rounded-lg">
              当番一覧で設定 →
            </Link>
          )}
        </div>
        {drivers.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {drivers.map((d) => (
              <span key={d.parentName} className="text-sm bg-stone-100 text-stone-700 px-3 py-1 rounded-full">
                {d.parentName}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">未設定</p>
        )}
      </div>

      {/* 備品持帰り（読み取り専用） */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-gray-700">備品持帰り当番</h2>
          {!VIEW_ONLY && (
            <Link href={`/duty-roster?matchId=${id}`}
              className="text-sm text-stone-700 border border-stone-200 px-3 py-1 rounded-lg">
              当番一覧で設定 →
            </Link>
          )}
        </div>
        {equipOutNames.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {equipOutNames.map((n) => (
              <span key={n} className="text-sm bg-stone-200 text-stone-700 px-3 py-1 rounded-full">
                {n}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">未設定</p>
        )}
      </div>
    </main>
  );
}
