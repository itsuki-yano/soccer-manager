"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import BackHeader from "@/components/BackHeader";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    teamName: "", gasPricePerKm: 16, accountant: "", leagueName: "", logoUrl: "",
    bucketDutyStartDate: "", bucketDutyEndDate: "", leagueTableUrl: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [pwModal, setPwModal] = useState(false);
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const SHEET_URL = "https://docs.google.com/spreadsheets/d/1X7qM1JvYT2RT16a8enu2agzEOMFRxwCexSga33p6H2k";
  function tryOpenSheet() {
    if (pw === "0404") {
      window.open(SHEET_URL, "_blank", "noopener,noreferrer");
      setPwModal(false); setPw(""); setPwError(false);
    } else {
      setPwError(true);
    }
  }

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      setSettings(d);
      setLoading(false);
    });
  }, []);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/settings/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) {
      const newSettings = { ...settings, logoUrl: data.url };
      setSettings(newSettings);
      // ロゴは即保存
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSettings),
      });
    }
    setUploadingLogo(false);
  }

  async function removeLogo() {
    const newSettings = { ...settings, logoUrl: "" };
    setSettings(newSettings);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newSettings),
    });
  }

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
      {/* チームロゴ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <label className="block text-sm font-medium text-gray-600 mb-3">チームロゴ</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50 overflow-hidden flex-shrink-0">
            {settings.logoUrl ? (
              <Image src={settings.logoUrl} alt="チームロゴ" width={80} height={80} className="w-full h-full object-contain" />
            ) : (
              <span className="text-3xl">⚽</span>
            )}
          </div>
          <div className="grid gap-2 flex-1">
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {uploadingLogo ? "アップロード中..." : settings.logoUrl ? "ロゴを変更" : "ロゴを設定"}
            </button>
            {settings.logoUrl && (
              <button onClick={removeLogo} className="w-full bg-gray-100 text-gray-500 py-2 rounded-lg text-sm">
                削除
              </button>
            )}
            <p className="text-xs text-gray-400">PNG / JPG / SVG 推奨</p>
          </div>
        </div>
      </div>

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
        <Field label="リーグ戦績表URL（少年サッカー応援団）">
          <input
            type="url"
            value={settings.leagueTableUrl}
            onChange={(e) => setSettings((s) => ({ ...s, leagueTableUrl: e.target.value }))}
            placeholder="https://junior-soccer.jp/sp/tokai/aichi/league/table/..."
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">「リーグ戦戦績」画面の取得元。シーズン更新時に変更してください。</p>
        </Field>
        <Field label="会計担当者">
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
          className="w-full bg-stone-700 text-white py-3 rounded-xl font-semibold disabled:opacity-50 mt-2"
        >
          {saved ? "✓ 保存しました" : saving ? "保存中..." : "保存"}
        </button>
      </div>

      {/* バケツ当番期間 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mt-4 grid gap-3">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🪣</span>
          <span className="font-semibold text-gray-700 text-sm">バケツ当番の有効期間</span>
        </div>
        <p className="text-xs text-gray-400 -mt-2">この期間の練習にバケツ当番を表示します。未設定の場合は常に非表示。</p>
        <Field label="開始日">
          <input
            type="date"
            value={settings.bucketDutyStartDate}
            onChange={(e) => setSettings((s) => ({ ...s, bucketDutyStartDate: e.target.value }))}
            className="input"
          />
        </Field>
        <Field label="終了日">
          <input
            type="date"
            value={settings.bucketDutyEndDate}
            onChange={(e) => setSettings((s) => ({ ...s, bucketDutyEndDate: e.target.value }))}
            className="input"
          />
        </Field>
        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-stone-700 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50 text-sm"
        >
          {saved ? "✓ 保存しました" : saving ? "保存中..." : "保存"}
        </button>
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h3 className="font-semibold text-amber-800 mb-2">Googleスプレッドシート連携</h3>
        <p className="text-sm text-amber-800">
          データはGoogleスプレッドシートに保存されます。<br />
          サービスアカウントの設定が必要です（.env.local）。
        </p>
        <button
          onClick={() => { setPwModal(true); setPw(""); setPwError(false); }}
          className="block mt-2 text-sm text-stone-700 underline"
        >
          スプレッドシートを開く →
        </button>
      </div>

      {pwModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4" onClick={() => setPwModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-gray-800 mb-1">パスワード入力</h2>
            <p className="text-xs text-gray-500 mb-3">スプレッドシートを開くにはパスワードが必要です。</p>
            <input
              type="password"
              inputMode="numeric"
              value={pw}
              autoFocus
              onChange={(e) => { setPw(e.target.value); setPwError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") tryOpenSheet(); }}
              className="input w-full"
              placeholder="パスワード"
            />
            {pwError && <p className="text-xs text-red-500 mt-1">パスワードが違います</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={tryOpenSheet} className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold">開く</button>
              <button onClick={() => setPwModal(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
            </div>
          </div>
        </div>
      )}
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
