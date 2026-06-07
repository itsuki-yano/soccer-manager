"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import type { Memo } from "@/lib/types";

function fmtDateTime(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MemoPage() {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    fetch("/api/memos").then((r) => r.json()).then((d) => {
      setMemos(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  async function addMemo() {
    if (!newText.trim()) return;
    setSaving(true);
    const res = await fetch("/api/memos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newText.trim() }),
    });
    const data = await res.json();
    setMemos((prev) => [{ id: data.id, content: newText.trim(), createdAt: data.createdAt, updatedAt: data.updatedAt }, ...prev]);
    setNewText("");
    setSaving(false);
  }

  function startEdit(memo: Memo) {
    setEditId(memo.id);
    setEditText(memo.content);
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/memos/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editText.trim() }),
    });
    const data = await res.json();
    setMemos((prev) => prev.map((m) => m.id === id ? { ...m, content: editText.trim(), updatedAt: data.updatedAt } : m));
    setEditId(null);
    setSaving(false);
  }

  async function deleteMemo(id: string) {
    if (!confirm("このメモを削除しますか？")) return;
    await fetch(`/api/memos/${id}`, { method: "DELETE" });
    setMemos((prev) => prev.filter((m) => m.id !== id));
  }

  const sorted = [...memos].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="備忘録" />

      {/* 新規入力 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="メモを入力..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
        />
        <button
          onClick={addMemo}
          disabled={saving || !newText.trim()}
          className="mt-2 w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
        >
          {saving ? "保存中..." : "追加"}
        </button>
      </div>

      {/* メモ一覧 */}
      <div className="grid gap-3">
        {sorted.map((memo) => (
          <div key={memo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {editId === memo.id ? (
              <>
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(memo.id)} disabled={saving}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-semibold">
                    キャンセル
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-800 text-sm whitespace-pre-wrap mb-3">{memo.content}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>作成: {fmtDateTime(memo.createdAt)}</div>
                    {memo.updatedAt !== memo.createdAt && (
                      <div className="text-blue-400">更新: {fmtDateTime(memo.updatedAt)}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(memo)}
                      className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg">
                      修正
                    </button>
                    <button onClick={() => deleteMemo(memo.id)}
                      className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-lg">
                      削除
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-gray-400 py-8">メモがありません</p>}
      </div>
    </main>
  );
}
