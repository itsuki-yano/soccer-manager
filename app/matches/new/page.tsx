"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";

export default function NewMatchPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: "",
    matchName: "",
    opponent: "",
    venue: "",
    address: "",
    distanceKm: "",
    carCount: "",
    accountant: "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.date || !form.opponent || !form.venue) {
      alert("日付・対戦相手・会場は必須です");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        distanceKm: Number(form.distanceKm),
        carCount: Number(form.carCount),
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
      <BackHeader title="試合を追加" back="/matches" />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid gap-4">
        <Field label="試合日 *">
          <input type="date" value={form.date} onChange={set("date")} className="input" />
        </Field>
        <Field label="試合名">
          <input type="text" value={form.matchName} onChange={set("matchName")} placeholder="例: 公式戦 西三河U10前半" className="input" />
        </Field>
        <Field label="対戦相手 *">
          <input type="text" value={form.opponent} onChange={set("opponent")} placeholder="例: 明和" className="input" />
        </Field>
        <Field label="会場名 *">
          <input type="text" value={form.venue} onChange={set("venue")} placeholder="例: 若林東小学校" className="input" />
        </Field>
        <Field label="会場住所">
          <input type="text" value={form.address} onChange={set("address")} placeholder="例: 愛知県豊田市若林東町広間64" className="input" />
        </Field>
        <Field label="往復距離 (km) *">
          <input type="number" step="0.01" value={form.distanceKm} onChange={set("distanceKm")} placeholder="例: 20.76" className="input" />
        </Field>
        <Field label="配車台数">
          <input type="number" value={form.carCount} onChange={set("carCount")} placeholder="例: 4" className="input" />
        </Field>
        <Field label="会計担当者">
          <input type="text" value={form.accountant} onChange={set("accountant")} placeholder="例: 矢野諒" className="input" />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50"
        >
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
