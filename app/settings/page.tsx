"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    teamName: "", gasPricePerKm: 16, accountant: "", leagueName: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setSettings(d);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="設定" />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid gap-4">
        <Field label="チーム名">
          <input
            type="text"
            value={settings.teamName}
            onChange={(e) => setSettings((s) => ({ ...s, teamName: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="リーグ名">
          <input
            type="text"
            value={settings.leagueName}
            onChange={(e) => setSettings((s) => ({ ...s, leagueName: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="ガソリン単価 (円/km)">
          <input
            type="number"
            step="0.1"
            value={settings.gasPricePerKm}
            onChange={(e) => setSettings((s) => ({ ...s, gasPricePerKm: Number(e.target.value) }))}
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            例: 16円/km → 往復20.76km = 332円（10円単位四捨五入）
          </p>
        </Field>
        <Field label="デフォルト会計担当者">
          <input
            type="text"
            value={settings.accountant}
            onChange={(e) => setSettings((s) => ({ ...s, accountant: e.target.value }))}
            className="input"
          />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50 mt-2"
        >
          {saved ? "✓ 保存しました" : saving ? "保存中..." : "保存"}
        </button>
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">Googleスプレッドシート連携</h3>
        <p className="text-sm text-yellow-700">
          データはGoogleスプレッドシートに保存されます。<br />
          サービスアカウントの設定が必要です（.env.local）。
        </p>
        <a
          href="https://docs.google.com/spreadsheets/d/1X7qM1JvYT2RT16a8enu2agzEOMFRxwCexSga33p6H2k"
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-2 text-sm text-blue-500 underline"
        >
          スプレッドシートを開く →
        </a>
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
