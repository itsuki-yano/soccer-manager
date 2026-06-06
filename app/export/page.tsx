"use client";
import { useState } from "react";
import BackHeader from "@/components/BackHeader";

export default function ExportPage() {
  const [loading, setLoading] = useState(false);

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
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <div className="text-5xl mb-4">📊</div>
        <h2 className="text-lg font-bold text-gray-800 mb-2">精算書をダウンロード</h2>
        <p className="text-sm text-gray-500 mb-6">
          登録された全試合の配車費用・コーチ飲食費を<br />
          Excelファイルにまとめます。
        </p>
        <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-600 mb-6 space-y-1">
          <div>📋 公式戦試合日程（当番一覧・支払い明細）</div>
          <div>🚗 試合別交通費請求書</div>
          <div>🧃 コーチ飲食費一覧</div>
        </div>
        <button
          onClick={download}
          disabled={loading}
          className="w-full bg-green-500 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50"
        >
          {loading ? "生成中..." : "📥 ダウンロード"}
        </button>
      </div>
    </main>
  );
}
