"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Fee, FeePayment, Parent } from "@/lib/types";

const CAT_COLORS: Record<string, string> = {
  "合宿費用": "bg-purple-100 text-purple-700",
  "クラブ費": "bg-blue-100 text-blue-700",
  "イベント費用": "bg-orange-100 text-orange-700",
  "その他": "bg-gray-100 text-gray-600",
};

function fmtDate(d: string) {
  if (!d) return "";
  return d.replace(/-/g, "/");
}

export default function FeesPage() {
  const [fees, setFees] = useState<Fee[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/fees").then((r) => r.json()),
      fetch("/api/fee-payments").then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
    ]).then(([f, p, pr]) => {
      setFees(Array.isArray(f) ? f : []);
      setPayments(Array.isArray(p) ? p : []);
      setParents(Array.isArray(pr) ? pr : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const sorted = [...fees].sort((a, b) => b.date.localeCompare(a.date));
  const totalParents = parents.length;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="費用徴収管理" />
      <Link href="/fees/new"
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4 active:bg-blue-600">
        ＋ 費用を登録
      </Link>

      {sorted.length === 0 && (
        <p className="text-center text-gray-400 py-8">費用が登録されていません</p>
      )}

      <div className="grid gap-3">
        {sorted.map((fee) => {
          const feePayments = payments.filter((p) => p.feeId === fee.id);
          const paidCount = feePayments.filter((p) => p.paid).length;
          const total = fee.amount * totalParents;
          const collected = fee.amount * paidCount;
          const pct = totalParents > 0 ? Math.round((paidCount / totalParents) * 100) : 0;

          return (
            <Link key={fee.id} href={`/fees/${fee.id}`}
              className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 block active:bg-gray-50">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[fee.category] ?? CAT_COLORS["その他"]}`}>
                      {fee.category}
                    </span>
                    {fee.date && <span className="text-xs text-gray-400">{fmtDate(fee.date)}</span>}
                  </div>
                  <div className="font-bold text-gray-800">{fee.name}</div>
                  {fee.description && <div className="text-xs text-gray-500 mt-0.5">{fee.description}</div>}
                </div>
                <div className="text-right ml-2 flex-shrink-0">
                  <div className="font-bold text-gray-800">¥{fee.amount.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">/人</div>
                </div>
              </div>

              {/* 徴収進捗 */}
              <div className="mt-2">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>{paidCount}/{totalParents}名 徴収済み</span>
                  <span className="font-medium text-gray-700">
                    ¥{collected.toLocaleString()} / ¥{total.toLocaleString()}
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${pct === 100 ? "bg-green-500" : "bg-blue-400"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {pct === 100 && (
                  <div className="text-xs text-green-600 font-medium mt-1 text-right">✓ 徴収完了</div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
