"use client";
import { useState, useEffect } from "react";
import BackHeader from "@/components/BackHeader";

interface MatchPreview {
  id: string;
  date: string;
  matchName: string;
  matchType: string;
  venue: string;
  distanceKm: number;
  carCount: number;
  feePerCar: number;
  totalFee: number;
  drivers: string[];
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

export default function ExportPage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    fetch("/api/export/preview")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setPreviewError(d.error);
        else setPreview(d);
      })
      .catch(() => setPreviewError("プレビューの読み込みに失敗しました"))
      .finally(() => setPreviewLoading(false));
  }, []);

  async function download() {
    setLoading(true);
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
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="Excel出力" />

      {/* プレビューセクション */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">請求内容プレビュー</h2>

        {previewLoading && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">読み込み中...</div>
        )}

        {previewError && (
          <div className="bg-red-50 rounded-xl border border-red-100 p-4 text-red-600 text-sm">{previewError}</div>
        )}

        {preview && (
          <div className="grid gap-3">
            {/* 合計サマリー */}
            <div className="bg-blue-50 rounded-xl p-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-xs text-gray-500 mb-0.5">交通費合計</div>
                <div className="text-lg font-bold text-blue-600">{preview.transportTotal.toLocaleString()}円</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">コーチ飲食費</div>
                <div className="text-lg font-bold text-orange-500">{preview.coachExpenseTotal.toLocaleString()}円</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">合計</div>
                <div className="text-lg font-bold text-gray-800">{preview.grandTotal.toLocaleString()}円</div>
              </div>
            </div>

            {/* 精算あり試合一覧 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">🚗 精算あり試合</span>
                <span className="text-xs text-gray-400">{preview.matches.length}件</span>
              </div>
              {preview.matches.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-400 text-sm">精算対象の試合がありません</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {preview.matches.map((m) => (
                    <div key={m.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs text-gray-400">{m.date}</div>
                          <div className="text-sm font-medium text-gray-800 truncate">{m.matchName}</div>
                          <div className="text-xs text-gray-500 truncate">{m.venue}</div>
                          {m.drivers.length > 0 && (
                            <div className="text-xs text-blue-500 mt-0.5">
                              当番: {m.drivers.join("・")}
                            </div>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-bold text-gray-800">{m.totalFee.toLocaleString()}円</div>
                          <div className="text-xs text-gray-400">{m.feePerCar.toLocaleString()}×{m.carCount}台</div>
                          <div className="text-xs text-gray-400">{m.distanceKm}km</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* コーチ飲食費一覧 */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">🧃 コーチ飲食費</span>
                <span className="text-xs text-gray-400">{preview.coachExpenses.length}件</span>
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
      </div>

      {/* ダウンロードボタン */}
      <button
        onClick={download}
        disabled={loading || previewLoading}
        className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
      >
        {loading ? "生成中..." : "📥 Excelをダウンロード"}
      </button>
    </main>
  );
}
