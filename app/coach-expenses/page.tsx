"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { CoachExpense } from "@/lib/types";

export default function CoachExpensesPage() {
  const [expenses, setExpenses] = useState<CoachExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: "", description: "", amount: "", claimed: "" });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function resetForm() {
    setForm({ date: "", description: "", amount: "", claimed: "" });
    setEditingId(null);
  }

  useEffect(() => {
    fetch("/api/coach-expenses").then((r) => r.json()).then((d) => {
      setExpenses(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!form.date || !form.description || !form.amount) {
      alert("日付・内容・金額は必須です");
      return;
    }
    setSaving(true);
    const body = { ...form, amount: Number(form.amount) };
    if (editingId) {
      await fetch(`/api/coach-expenses/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setExpenses((prev) => prev.map((e) => e.id === editingId ? { ...e, ...body } : e));
    } else {
      const res = await fetch("/api/coach-expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const { id } = await res.json();
      setExpenses((prev) => [...prev, { id, ...body }]);
    }
    resetForm();
    setShowForm(false);
    setSaving(false);
  }

  async function del(id: string) {
    await fetch(`/api/coach-expenses/${id}`, { method: "DELETE" });
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setDeleteConfirm(null);
  }

  function startEdit(e: CoachExpense) {
    setForm({ date: e.date, description: e.description, amount: String(e.amount), claimed: e.claimed });
    setEditingId(e.id);
    setShowForm(true);
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="コーチ飲食費" />
      {deleteConfirm && (
        <DeleteConfirmModal
          message="この飲食費を削除しますか？"
          onConfirm={() => del(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <div className="bg-blue-50 rounded-xl p-4 mb-4 flex justify-between items-center">
        <span className="text-gray-600 font-medium">合計</span>
        <span className="text-2xl font-bold text-blue-600">{total.toLocaleString()}円</span>
      </div>

      <button
        onClick={() => { resetForm(); setShowForm((v) => !v); }}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showForm && !editingId ? "✕ キャンセル" : "＋ 費用を追加"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 grid gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">日付 *</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">内容 *</label>
            <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="例: 西三河リーグ vs高浜、コーチ飲み物代" className="input" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">金額(円) *</label>
            <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="例: 672" className="input" />
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="flex-1 bg-blue-500 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
              {saving ? "保存中..." : editingId ? "更新" : "保存"}
            </button>
            <button onClick={() => { setShowForm(false); resetForm(); }} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-lg font-semibold">
              キャンセル
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        {sorted.map((e) => (
          <div key={e.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-400">{e.date}</div>
              <div className="text-sm font-medium text-gray-800 truncate">{e.description}</div>
            </div>
            <div className="font-bold text-gray-800 whitespace-nowrap">{e.amount.toLocaleString()}円</div>
            <div className="flex gap-1">
              <button onClick={() => startEdit(e)} className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded">編集</button>
              <button onClick={() => setDeleteConfirm(e.id)} className="text-xs text-red-400 border border-red-100 px-2 py-1 rounded">削除</button>
            </div>
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-gray-400 py-8">費用が登録されていません</p>}
      </div>
    </main>
  );
}
