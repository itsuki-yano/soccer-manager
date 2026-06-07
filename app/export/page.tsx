"use client";
import { useState, useEffect, useCallback } from "react";
import BackHeader from "@/components/BackHeader";

interface MatchPreview {
  id: string;
  date: string;
  matchName: string;
  matchType: string;
  venue: string;
  distanceKm: number;
  carCount: number;
  gasPricePerKm: number;
  feePerCar: number;
  totalFee: number;
  drivers: string[];
  settlementStatus: string;
}

interface CoachExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface PreviewData {
  settings: { leagueName: string; gasPricePerKm: number };
  matches: MatchPreview[];
  coachExpenses: CoachExpense[];
  coachExpenseTotal: number;
  transportTotal: number;
  grandTotal: number;
}

const STATUS_OPTIONS = ["", "請求中", "精算済み"] as const;
const STATUS_LABEL: Record<string, string> = { "": "未請求", "請求中": "請求中", "精算済み": "精算済み" };
const STATUS_COLOR: Record<string, string> = {
  "": "bg-gray-100 text-gray-500",
  "請求中": "bg-yellow-100 text-yellow-700",
  "精算済み": "bg-green-100 text-green-700",
};
const STATUS_BORDER: Record<string, string> = {
  "": "border-gray-200",
  "請求中": "border-yellow-300",
  "精算済み": "border-green-300",
};

export default function ExportPage() {
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadPreview = useCallback(() => {
    setPreviewLoading(true);
    fetch("/api/export/preview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setPreviewError(d.error);
        else setPreview(d);
      })
      .catch(() => setPreviewError("プレビューの読み込みに失敗しました"))
      .finally(() => setPreviewLoading(false));
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function cycleStatus(matchId: string, current: string) {
    const idx = STATUS_OPTIONS.indexOf(current as typeof STATUS_OPTIONS[number]);
    const next = STATUS_OPTIONS[(idx + 1) % STATUS_OPTIONS.length];
    setUpdatingId(matchId);
    try {
      await fetch(`/api/matches/${matchId}/settlement-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settlementStatus: next }),
      });
      setPreview((prev) => prev ? {
        ...prev,
        matches: prev.matches.map((m) => m.id === matchId ? { ...m, settlementStatus: next } : m),
      } : prev);
    } finally {
      setUpdatingId(null);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) {
        const err = await res.json();
        alert("エラー: " + (err.error ?? "不明なエラー"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "配車請求.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const transportTotal = preview?.matches.reduce((s, m) => s + m.totalFee, 0) ?? 0;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="Excel出力" />

      {previewLoading && (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">読み込み中...</div>
      )}

      {previewError && (
        <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-red-600 text-sm mb-4">{previewError}</div>
      )}

      {preview && (
        <div className="grid gap-4 mb-4">

          {/* 合計サマリー */}
          <div className="bg-blue-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">交通費合計</div>
              <div className="text-lg font-bold text-blue-600">{transportTotal.toLocaleString()}円</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">コーチ飲食費</div>
              <div className="text-lg font-bold text-orange-500">{preview.coachExpenseTotal.toLocaleString()}円</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">合計</div>
              <div className="text-lg font-bold text-gray-800">{(transportTotal + preview.coachExpenseTotal).toLocaleString()}円</div>
            </div>
          </div>

          {/* 精算あり試合一覧 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">🚗 精算あり試合</span>
              <span className="text-xs text-gray-400">{preview.matches.length}件</span>
            </div>
            {preview.matches.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">
                精算対象の試合がありません<br />
                <span className="text-xs">試合登録時に「精算あり」を選択してください</span>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {preview.matches.map((m) => (
                  <div key={m.id} className={`p-4 border-l-4 ${STATUS_BORDER[m.settlementStatus ?? ""]}`}>
                    {/* ヘッダー行 */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-400">{m.date}</div>
                        <div className="text-sm font-semibold text-gray-800 truncate">{m.matchName}</div>
                        <div className="text-xs text-gray-500 truncate">{m.venue}</div>
                      </div>
                      {/* ステータスボタン（タップで切り替え） */}
                      <button
                        onClick={() => cycleStatus(m.id, m.settlementStatus ?? "")}
                        disabled={updatingId === m.id}
                        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition-opacity ${STATUS_COLOR[m.settlementStatus ?? ""]} ${STATUS_BORDER[m.settlementStatus ?? ""]} ${updatingId === m.id ? "opacity-40" : ""}`}
                      >
                        {STATUS_LABEL[m.settlementStatus ?? ""]}
                      </button>
                    </div>

                    {/* 費用内訳 */}
                    <div className="bg-gray-50 rounded-lg p-3 grid gap-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>往復距離</span>
                        <span className="font-medium">{m.distanceKm} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>ガス代単価</span>
                        <span className="font-medium">{m.gasPricePerKm} 円/km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1台あたり（{m.distanceKm} × {m.gasPricePerKm}）</span>
                        <span className="font-medium">{m.feePerCar.toLocaleString()} 円</span>
                      </div>
                      <div className="flex justify-between">
                        <span>配車台数</span>
                        <span className="font-medium">{m.carCount} 台</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1 mt-0.5 font-semibold text-gray-800">
                        <span>小計（{m.feePerCar.toLocaleString()} × {m.carCount}台）</span>
                        <span>{m.totalFee.toLocaleString()} 円</span>
                      </div>
                    </div>

                    {/* 当番 */}
                    {m.drivers.length > 0 && (
                      <div className="mt-2 text-xs text-blue-600">
                        当番: {m.drivers.join("・")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* コーチ飲食費一覧 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">🧃 コーチ飲食費</span>
              <span className="text-xs font-bold text-orange-500">{preview.coachExpenseTotal.toLocaleString()}円</span>
            </div>
            {preview.coachExpenses.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-400 text-sm">費用が登録されていません</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {preview.coachExpenses.map((e) => (
                  <div key={e.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-400">{e.date}</div>
                      <div className="text-sm text-gray-700 truncate">{e.description}</div>
                    </div>
                    <div className="text-sm font-bold text-gray-800 shrink-0">{e.amount.toLocaleString()}円</div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ダウンロードボタン */}
      <button
        onClick={download}
        disabled={downloading || previewLoading}
        className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
      >
        {downloading ? "生成中..." : "📥 Excelをダウンロード"}
      </button>
    </main>
  );
}
