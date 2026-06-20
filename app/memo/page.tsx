"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
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
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/init").finally(() => {
      fetch("/api/memos").then((r) => r.json()).then((d) => {
        setMemos(Array.isArray(d) ? d : []);
        setLoading(false);
      });
    });
  }, []);

  async function addMemo() {
    if (!newText.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/memos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newText.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.id) {
        setError("保存に失敗しました: " + (data.error ?? ""));
        return;
      }
      setMemos((prev) => [{
        id: data.id,
        content: newText.trim(),
        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
      }, ...prev]);
      setNewText("");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(memo: Memo) {
    setEditId(memo.id);
    setEditText(memo.content);
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/memos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      const data = await res.json();
      const updatedAt = data.updatedAt ?? new Date().toISOString();
      setMemos((prev) => prev.map((m) => m.id === id ? { ...m, content: editText.trim(), updatedAt } : m));
      setEditId(null);
    } finally {
      setSaving(false);
    }
  }

  async function deleteMemo(id: string) {
    await fetch(`/api/memos/${id}`, { method: "DELETE" });
    setMemos((prev) => prev.filter((m) => m.id !== id));
    setDeleteConfirm(null);
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const sorted = [...memos].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="備忘録" />
      {deleteConfirm && (
        <DeleteConfirmModal
          message="このメモを削除しますか？"
          onConfirm={() => deleteMemo(deleteConfirm)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* 新規入力 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="メモを入力..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        <button
          onClick={addMemo}
          disabled={saving || !newText.trim()}
          className="mt-2 w-full bg-stone-700 text-white py-2.5 rounded-lg font-semibold text-sm disabled:opacity-50"
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
                  className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-stone-300 mb-2"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(memo.id)} disabled={saving}
                    className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
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
                <p className="text-gray-800 text-sm whitespace-pre-wrap mb-3">
                  {memo.content.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
                    /^https?:\/\//.test(part) ? (
                      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
                        className="text-stone-700 underline break-all">
                        {part}
                      </a>
                    ) : part
                  )}
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-400 space-y-0.5">
                    <div>作成: {fmtDateTime(memo.createdAt)}</div>
                    {memo.updatedAt && memo.updatedAt !== memo.createdAt && (
                      <div className="text-stone-500">更新: {fmtDateTime(memo.updatedAt)}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => startEdit(memo)}
                      className="text-xs text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg">
                      修正
                    </button>
                    <button onClick={() => setDeleteConfirm(memo.id)}
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
