"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";

const MATCH_TYPES = ["公式戦", "合宿", "TM", "その他"];

export default function NewMatchPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [matchType, setMatchType] = useState("公式戦");
  const [needsSettlement, setNeedsSettlement] = useState(true);
  const [equipmentBringIn, setEquipmentBringIn] = useState("");
  const [equipmentBringOut, setEquipmentBringOut] = useState("");
  const [form, setForm] = useState({
    date: "", matchName: "", opponent: "", venue: "", address: "", distanceKm: "", carCount: "",
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function calcDistance(address: string) {
    if (!address.trim()) return;
    setCalcLoading(true);
    try {
      const res = await fetch(`/api/distance?address=${encodeURIComponent(address)}`);
      const data = await res.json();
      if (data.roundTripKm) setForm((f) => ({ ...f, distanceKm: String(data.roundTripKm) }));
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

  async function save() {
    if (!form.date || !form.venue) { alert("日付・会場は必須です"); return; }
    setSaving(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        matchType,
        needsSettlement,
        matchName: form.matchName || `${matchType} ${form.opponent}`.trim(),
        distanceKm: Number(form.distanceKm),
        carCount: Number(form.carCount),
        bandUid: "",
        equipmentBringIn,
        equipmentBringOut,
      }),
    });
    if (res.ok) {
      router.push("/matches");
    } else {
      alert("保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="試合・合宿を追加" back="/matches" />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid gap-4">

        <Field label="種別 *">
          <div className="grid grid-cols-4 gap-2">
            {MATCH_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setMatchType(t)}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                  matchType === t ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-600 border-gray-200"
                }`}>{t}</button>
            ))}
          </div>
        </Field>

        <Field label="精算">
          <button
            type="button"
            onClick={() => setNeedsSettlement((v) => !v)}
            className={`w-full py-2.5 rounded-lg text-sm font-medium border transition-colors ${
              needsSettlement ? "bg-orange-500 text-white border-orange-500" : "bg-gray-50 text-gray-500 border-gray-200"
            }`}
          >
            {needsSettlement ? "💴 精算あり（交通費発生）" : "精算なし"}
          </button>
        </Field>

        <Field label="試合日 *">
          <input type="date" value={form.date} onChange={set("date")} className="input" />
        </Field>

        <Field label="試合名">
          <input type="text" value={form.matchName} onChange={set("matchName")}
            placeholder={`例: ${matchType} 西三河U10前半`} className="input" />
        </Field>

        {matchType !== "合宿" && (
          <Field label="対戦相手">
            <input type="text" value={form.opponent} onChange={set("opponent")} placeholder="例: 明和" className="input" />
          </Field>
        )}

        <Field label="会場名 *">
          <input type="text" value={form.venue} onChange={set("venue")}
            placeholder={matchType === "合宿" ? "例: ○○合宿所" : "例: 若林東小学校"} className="input" />
        </Field>

        <Field label="会場住所（入力で距離を自動計算）">
          <input type="text" value={form.address} onChange={onAddressChange}
            placeholder="例: 愛知県豊田市若林東町広間64" className="input" />
          <p className="text-xs text-gray-400 mt-1">出発地: かりがね小学校（刈谷市）</p>
        </Field>

        <Field label={`往復距離 (km)${calcLoading ? " ⏳ 計算中..." : ""}`}>
          <div className="flex gap-2">
            <input type="number" step="0.01" value={form.distanceKm}
              onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))}
              placeholder="住所入力で自動計算" className="input flex-1" />
            {form.address && (
              <button type="button" onClick={() => calcDistance(form.address)} disabled={calcLoading}
                className="bg-gray-100 text-gray-600 px-3 rounded-lg text-sm whitespace-nowrap disabled:opacity-50">
                再計算
              </button>
            )}
          </div>
        </Field>

        <Field label="配車台数">
          <input type="number" value={form.carCount} onChange={set("carCount")} placeholder="例: 4" className="input" />
        </Field>

        {(form.venue.includes("かりがね") || form.address.includes("かりがね")) && (
          <>
            <Field label="備品当番 - 持ってくる班/担当者">
              <input type="text" value={equipmentBringIn} onChange={(e) => setEquipmentBringIn(e.target.value)}
                placeholder="例: 2班 または 田中さん" className="input" />
            </Field>
            <Field label="備品当番 - 持ち帰る班/担当者">
              <input type="text" value={equipmentBringOut} onChange={(e) => setEquipmentBringOut(e.target.value)}
                placeholder="例: 3班 または 鈴木さん" className="input" />
            </Field>
          </>
        )}

        <button onClick={save} disabled={saving}
          className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50">
          {saving ? "保存中..." : "保存"}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
