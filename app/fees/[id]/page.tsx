"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Fee, FeePayment, Parent } from "@/lib/types";

const CATEGORIES = ["合宿費用", "クラブ費", "イベント費用", "その他"];
const CAT_COLORS: Record<string, string> = {
  "合宿費用": "bg-amber-100 text-amber-800",
  "クラブ費": "bg-stone-100 text-stone-700",
  "イベント費用": "bg-amber-100 text-amber-800",
  "その他": "bg-gray-100 text-gray-600",
};

export default function FeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [fee, setFee] = useState<Fee | null>(null);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [filterGroup, setFilterGroup] = useState("全員");
  const [filterPaid, setFilterPaid] = useState<"all" | "paid" | "unpaid">("all");
  const [sortMode, setSortMode] = useState<"班" | "背番号">("班");
  const [form, setForm] = useState({ name: "", category: "クラブ費", amount: "", date: "", description: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/fees").then((r) => r.json()),
      fetch(`/api/fee-payments?feeId=${id}`).then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
    ]).then(([fees, pays, prts]) => {
      const f = (Array.isArray(fees) ? fees : []).find((x: Fee) => x.id === id);
      if (f) {
        setFee(f);
        setForm({ name: f.name, category: f.category, amount: String(f.amount), date: f.date, description: f.description });
      }
      setPayments(Array.isArray(pays) ? pays : []);
      setParents(Array.isArray(prts) ? prts : []);
      setLoading(false);
    });
  }, [id]);

  async function saveFee() {
    if (!form.name.trim() || !form.amount) return;
    setSaving(true);
    await fetch(`/api/fees/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    setFee((prev) => prev ? { ...prev, ...form, amount: Number(form.amount) } : prev);
    setEditing(false);
    setSaving(false);
  }

  async function deleteFee() {
    await fetch(`/api/fees/${id}`, { method: "DELETE" });
    router.push("/fees");
  }

  async function togglePaid(parent: Parent) {
    const key = parent.id;
    setToggling((prev) => new Set(prev).add(key));
    const current = payments.find((p) => p.parentId === parent.id);
    const isNotJoining = current?.paidAt === "不参加";
    if (isNotJoining) { setToggling((prev) => { const s = new Set(prev); s.delete(key); return s; }); return; }
    const newPaid = !(current?.paid ?? false);
    try {
      const res = await fetch("/api/fee-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId: id, parentId: parent.id, paid: newPaid, paidAt: "" }),
      });
      if (!res.ok) throw new Error("保存失敗");
      const data = await res.json();
      setPayments((prev) => {
        const filtered = prev.filter((p) => !(p.feeId === id && p.parentId === parent.id));
        return [...filtered, { feeId: id, parentId: parent.id, paid: newPaid, paidAt: data.paidAt ?? "" }];
      });
    } catch {
      alert("保存に失敗しました。再度お試しください。");
    }
    setToggling((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function toggleNotJoining(parent: Parent) {
    const key = parent.id;
    setToggling((prev) => new Set(prev).add(key));
    const current = payments.find((p) => p.parentId === parent.id);
    const isNotJoining = current?.paidAt === "不参加";
    const newPaidAt = isNotJoining ? "" : "不参加";
    try {
      const res = await fetch("/api/fee-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeId: id, parentId: parent.id, paid: false, paidAt: newPaidAt }),
      });
      if (!res.ok) throw new Error("保存失敗");
      setPayments((prev) => {
        const filtered = prev.filter((p) => !(p.feeId === id && p.parentId === parent.id));
        if (isNotJoining) return filtered;
        return [...filtered, { feeId: id, parentId: parent.id, paid: false, paidAt: "不参加" }];
      });
    } catch {
      alert("保存に失敗しました。再度お試しください。");
    }
    setToggling((prev) => { const s = new Set(prev); s.delete(key); return s; });
  }

  async function markAllPaid() {
    if (!confirm("全員を徴収済みにしますか？")) return;
    for (const p of activeParents) {
      const current = payments.find((x) => x.parentId === p.id);
      if (!current?.paid) await togglePaid(p);
    }
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;
  if (!fee) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-red-400">費用が見つかりません</div>;

  const notJoiningIds = new Set(payments.filter((p) => p.paidAt === "不参加").map((p) => p.parentId));
  const activeParents = parents.filter((p) => !notJoiningIds.has(p.id));
  const paidCount = payments.filter((p) => p.paid && !notJoiningIds.has(p.parentId)).length;
  const totalParents = activeParents.length;
  const pct = totalParents > 0 ? Math.round((paidCount / totalParents) * 100) : 0;
  const collected = fee.amount * paidCount;
  const total = fee.amount * totalParents;

  // グループ分け
  const groups = [...new Set(parents.map((p) => p.group))].filter(Boolean).sort();
  const filteredParents = parents.filter((p) => {
    if (filterGroup !== "全員" && p.group !== filterGroup.replace("班", "")) return false;
    if (filterPaid === "paid" && !payments.find((x) => x.parentId === p.id && x.paid)) return false;
    if (filterPaid === "unpaid" && (payments.find((x) => x.parentId === p.id && x.paid) || notJoiningIds.has(p.id))) return false;
    return true;
  }).sort((a, b) => {
    if (sortMode === "背番号") {
      const na = Number(a.uniformNumber || a.jerseyNumber) || 999;
      const nb = Number(b.uniformNumber || b.jerseyNumber) || 999;
      return na - nb;
    }
    return (a.group ?? "").localeCompare(b.group ?? "") || a.furigana.localeCompare(b.furigana);
  });

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="費用詳細" back="/fees" />
      {showDeleteConfirm && (
        <DeleteConfirmModal
          message={`「${fee?.name ?? "この費用"}」を削除しますか？`}
          onConfirm={deleteFee}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* 費用情報 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        {editing ? (
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">カテゴリ</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button key={c} type="button" onClick={() => setForm((f) => ({ ...f, category: c }))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.category === c ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"
                    }`}>{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">費用名</label>
              <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">金額（1人あたり）</label>
              <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">日付</label>
              <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">メモ</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveFee} disabled={saving} className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                {saving ? "保存中..." : "保存"}
              </button>
              <button onClick={() => setEditing(false)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[fee.category] ?? CAT_COLORS["その他"]}`}>{fee.category}</span>
                  {fee.date && <span className="text-xs text-gray-400">{fee.date.replace(/-/g, "/")}</span>}
                </div>
                <div className="font-bold text-gray-800 text-lg">{fee.name}</div>
                {fee.description && <div className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{fee.description}</div>}
              </div>
              <div className="text-right ml-2">
                <div className="text-xl font-bold text-gray-800">¥{fee.amount.toLocaleString()}</div>
                <div className="text-xs text-gray-400">/人</div>
              </div>
            </div>

            {/* 進捗サマリー */}
            <div className="bg-gray-50 rounded-xl p-3 mb-3">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">{paidCount}/{totalParents}名 徴収済み</span>
                <span className="font-bold text-gray-800">¥{collected.toLocaleString()} / ¥{total.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full transition-all ${pct === 100 ? "bg-emerald-700" : "bg-stone-600"}`}
                  style={{ width: `${pct}%` }} />
              </div>
              {pct === 100 && <div className="text-xs text-emerald-700 font-medium mt-1 text-center">✓ 全員徴収完了！</div>}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setEditing(true)} className="flex-1 text-sm text-gray-500 border border-gray-200 py-2 rounded-lg">編集</button>
              {pct < 100 && (
                <button onClick={markAllPaid} className="flex-1 text-sm bg-emerald-700 text-white py-2 rounded-lg font-medium">全員徴収済みにする</button>
              )}
            </div>
            <button onClick={() => setShowDeleteConfirm(true)} className="mt-2 w-full text-red-400 text-sm py-2 border border-red-100 rounded-lg">
              この費用を削除
            </button>
          </>
        )}
      </div>

      {/* 選手ごとの徴収状況 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="font-bold text-gray-700 mb-3">徴収状況</h2>

        {/* フィルター */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {["全員", ...groups.map((g) => `${g}班`)].map((g) => (
            <button key={g} onClick={() => setFilterGroup(g)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterGroup === g ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"
              }`}>{g}</button>
          ))}
        </div>
        <div className="flex gap-2 mb-3">
          {(["all", "unpaid", "paid"] as const).map((v) => (
            <button key={v} onClick={() => setFilterPaid(v)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterPaid === v ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-200"
              }`}>
              {v === "all" ? "すべて" : v === "paid" ? "徴収済み" : "未徴収"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-gray-400">並び順:</span>
          {(["班", "背番号"] as const).map((m) => (
            <button key={m} onClick={() => setSortMode(m)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                sortMode === m ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-white text-gray-600 border-gray-200"
              }`}>{m}</button>
          ))}
        </div>

        <div className="grid gap-2">
          {filteredParents.map((p) => {
            const payment = payments.find((x) => x.parentId === p.id);
            const paid = payment?.paid ?? false;
            const isToggling = toggling.has(p.id);
            return (
              <div key={p.id} className={`flex items-center justify-between py-2 border-b border-gray-50 last:border-0 ${notJoiningIds.has(p.id) ? "opacity-40" : ""}`}>
                <div className="flex items-center gap-2">
                  {p.group && <span className="text-xs text-gray-400 w-8">{p.group}班</span>}
                  <div>
                    <span className="text-sm font-medium text-gray-800">{p.playerName}</span>
                    <span className="text-xs text-gray-400 ml-1">{p.furigana}</span>
                  </div>
                  {notJoiningIds.has(p.id) && <span className="text-xs text-gray-400 border border-gray-200 rounded px-1">不参加</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  {paid && payment?.paidAt && payment.paidAt !== "不参加" && (
                    <span className="text-xs text-gray-400">{payment.paidAt.slice(0, 10).replace(/-/g, "/")}</span>
                  )}
                  {!notJoiningIds.has(p.id) && (
                    <button
                      onClick={() => togglePaid(p)}
                      disabled={isToggling}
                      className={`min-w-[72px] px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors disabled:opacity-50 ${
                        paid ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-500 border-gray-300"
                      }`}
                    >
                      {isToggling ? "…" : paid ? "✓ 徴収済" : "未徴収"}
                    </button>
                  )}
                  <button
                    onClick={() => toggleNotJoining(p)}
                    disabled={isToggling}
                    className="text-xs text-gray-400 border border-gray-200 px-2 py-1.5 rounded-full disabled:opacity-50"
                  >
                    {notJoiningIds.has(p.id) ? "復帰" : "不参加"}
                  </button>
                </div>
              </div>
            );
          })}
          {filteredParents.length === 0 && (
            <p className="text-center text-gray-400 py-4 text-sm">該当する選手がいません</p>
          )}
        </div>
      </div>
    </main>
  );
}
