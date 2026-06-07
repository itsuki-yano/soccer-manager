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

interface PreviewData {
  settings: { leagueName: string; gasPricePerKm: number };
  matches: MatchPreview[];
  coachExpenses: { id: string; date: string; description: string; amount: number }[];
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

// 日付範囲モーダル
function DateRangeModal({ title, onConfirm, onCancel }: {
  title: string;
  onConfirm: (from: string, to: string) => void;
  onCancel: () => void;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-800 mb-4">{title}</h3>
        <div className="grid gap-3 mb-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">開始日</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">終了日</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input w-full" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onConfirm(from, to)} className="flex-1 bg-blue-500 text-white py-2.5 rounded-xl font-semibold">
            出力
          </button>
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-semibold">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

// 確認モーダル
function ConfirmModal({ message, onConfirm, onCancel }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <p className="text-sm text-gray-700 mb-6 whitespace-pre-line">{message}</p>
        <div className="flex gap-2">
          <button onClick={onConfirm} className="flex-1 bg-orange-500 text-white py-2.5 rounded-xl font-semibold">
            OK
          </button>
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-semibold">
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}

// 完了モーダル
function DoneModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-sm text-gray-700 mb-6 whitespace-pre-line">{message}</p>
        <button onClick={onClose} className="w-full bg-blue-500 text-white py-2.5 rounded-xl font-semibold">
          閉じる
        </button>
      </div>
    </div>
  );
}

export default function ExportPage() {
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [loadingType, setLoadingType] = useState<string | null>(null);

  // モーダル状態
  const [modal, setModal] = useState<
    | { type: "confirm-issue" }
    | { type: "date-range"; exportType: "settled" | "all" }
    | { type: "done"; message: string }
    | null
  >(null);

  const loadPreview = useCallback(() => {
    setPreviewLoading(true);
    fetch("/api/export/preview")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setPreview(d); })
      .finally(() => setPreviewLoading(false));
  }, []);

  useEffect(() => { loadPreview(); }, [loadPreview]);

  async function doExport(exportType: string, dateFrom = "", dateTo = "") {
    setLoadingType(exportType);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType, dateFrom, dateTo }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert("エラー: " + (err.error ?? "不明なエラー"));
        return;
      }
      const count = res.headers.get("X-Match-Count") ?? "0";
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") ?? "";
      const fnMatch = cd.match(/filename\*=UTF-8''(.+)/);
      a.download = fnMatch ? decodeURIComponent(fnMatch[1]) : "配車請求.xlsx";
      a.click();
      URL.revokeObjectURL(url);

      const now = new Date().toLocaleString("ja-JP");
      const typeLabel: Record<string, string> = {
        billing: "請求中",
        "issue-unbilled": "未請求発行",
        settled: "精算済み",
        all: "全データ",
      };
      setModal({
        type: "done",
        message: `【${typeLabel[exportType] ?? exportType}】\n${count}件を出力しました\n出力日時: ${now}`,
      });

      // 未請求発行後はプレビューを再読み込み
      if (exportType === "issue-unbilled") loadPreview();
    } finally {
      setLoadingType(null);
    }
  }

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

  const unbilledCount = preview?.matches.filter((m) => !m.settlementStatus).length ?? 0;
  const billingTotal = preview?.matches.filter((m) => m.settlementStatus === "請求中").reduce((s, m) => s + m.totalFee, 0) ?? 0;
  const settledTotal = preview?.matches.filter((m) => m.settlementStatus === "精算済み").reduce((s, m) => s + m.totalFee, 0) ?? 0;
  const unbilledTotal = preview?.matches.filter((m) => !m.settlementStatus).reduce((s, m) => s + m.totalFee, 0) ?? 0;
  const transportTotal = (billingTotal + settledTotal + unbilledTotal);

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="Excel出力" />

      {/* 4つの出力ボタン */}
      <div className="grid gap-3 mb-5">

        <button
          onClick={() => doExport("billing")}
          disabled={!!loadingType}
          className="w-full bg-yellow-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-between px-4"
        >
          <span>📋 請求中作成</span>
          <span className="text-xs font-normal opacity-80">請求中の試合を出力</span>
        </button>

        <button
          onClick={() => setModal({ type: "confirm-issue" })}
          disabled={!!loadingType || unbilledCount === 0}
          className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-between px-4"
        >
          <span>📤 未請求発行</span>
          <span className="text-xs font-normal opacity-80">未請求 {unbilledCount}件 → 請求中に変更して出力</span>
        </button>

        <button
          onClick={() => setModal({ type: "date-range", exportType: "settled" })}
          disabled={!!loadingType}
          className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-between px-4"
        >
          <span>✅ 精算済発行</span>
          <span className="text-xs font-normal opacity-80">期間指定して精算済みを出力</span>
        </button>

        <button
          onClick={() => setModal({ type: "date-range", exportType: "all" })}
          disabled={!!loadingType}
          className="w-full bg-blue-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-between px-4"
        >
          <span>📊 全て出力</span>
          <span className="text-xs font-normal opacity-80">期間指定して全ステータスを出力</span>
        </button>

        {loadingType && (
          <div className="text-center text-sm text-gray-400 py-1">生成中...</div>
        )}
      </div>

      {/* プレビューサマリー */}
      {!previewLoading && preview && (
        <div className="grid gap-3">
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-600">🚗 交通費（精算あり試合）</span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-gray-100">
              <div className="p-3 text-center">
                <div className="text-xs text-gray-400 mb-0.5">未請求</div>
                <div className="text-base font-bold text-gray-500">{unbilledTotal.toLocaleString()}円</div>
                <div className="text-xs text-gray-300">{preview.matches.filter((m) => !m.settlementStatus).length}件</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xs text-yellow-600 mb-0.5">請求中</div>
                <div className="text-base font-bold text-yellow-600">{billingTotal.toLocaleString()}円</div>
                <div className="text-xs text-gray-300">{preview.matches.filter((m) => m.settlementStatus === "請求中").length}件</div>
              </div>
              <div className="p-3 text-center">
                <div className="text-xs text-green-600 mb-0.5">精算済み</div>
                <div className="text-base font-bold text-green-600">{settledTotal.toLocaleString()}円</div>
                <div className="text-xs text-gray-300">{preview.matches.filter((m) => m.settlementStatus === "精算済み").length}件</div>
              </div>
            </div>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 grid grid-cols-2 gap-3 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">コーチ飲食費</div>
              <div className="text-base font-bold text-orange-500">{preview.coachExpenseTotal.toLocaleString()}円</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">総合計</div>
              <div className="text-base font-bold text-blue-600">{(transportTotal + preview.coachExpenseTotal).toLocaleString()}円</div>
            </div>
          </div>

          {/* 試合一覧 */}
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 flex items-center justify-between border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">🚗 精算あり試合</span>
              <span className="text-xs text-gray-400">{preview.matches.length}件</span>
            </div>
            {preview.matches.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">精算対象の試合がありません</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {preview.matches.map((m) => (
                  <div key={m.id} className={`p-4 border-l-4 ${STATUS_BORDER[m.settlementStatus ?? ""]}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs text-gray-400">{m.date}</div>
                        <div className="text-sm font-semibold text-gray-800 truncate">{m.matchName}</div>
                        <div className="text-xs text-gray-500 truncate">{m.venue}</div>
                      </div>
                      <button
                        onClick={() => cycleStatus(m.id, m.settlementStatus ?? "")}
                        disabled={updatingId === m.id}
                        className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border transition-opacity ${STATUS_COLOR[m.settlementStatus ?? ""]} ${STATUS_BORDER[m.settlementStatus ?? ""]} ${updatingId === m.id ? "opacity-40" : ""}`}
                      >
                        {STATUS_LABEL[m.settlementStatus ?? ""]}
                      </button>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 grid gap-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>往復距離</span><span className="font-medium">{m.distanceKm} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1台あたり（{m.distanceKm} × {m.gasPricePerKm}）</span>
                        <span className="font-medium">{m.feePerCar.toLocaleString()} 円</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-200 pt-1 mt-0.5 font-semibold text-gray-800">
                        <span>小計（{m.feePerCar.toLocaleString()} × {m.carCount}台）</span>
                        <span>{m.totalFee.toLocaleString()} 円</span>
                      </div>
                    </div>
                    {m.drivers.length > 0 && (
                      <div className="mt-2 text-xs text-blue-600">当番: {m.drivers.join("・")}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* コーチ飲食費 */}
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

      {/* モーダル */}
      {modal?.type === "confirm-issue" && (
        <ConfirmModal
          message={`${unbilledCount}件の未請求を「請求中」に変更してExcelを出力します。\nよろしいですか？`}
          onConfirm={() => { setModal(null); doExport("issue-unbilled"); }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "date-range" && (
        <DateRangeModal
          title={modal.exportType === "settled" ? "精算済発行 — 出力期間を選択" : "全て出力 — 出力期間を選択"}
          onConfirm={(from, to) => { setModal(null); doExport(modal.exportType, from, to); }}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === "done" && (
        <DoneModal message={modal.message} onClose={() => setModal(null)} />
      )}
    </main>
  );
}
