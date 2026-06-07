"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import type { Parent } from "@/lib/types";

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    fetch("/api/parents").then((r) => r.json()).then((d) => {
      setParents(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  async function save() {
    if (!playerName.trim()) { alert("選手名は必須です"); return; }
    setSaving(true);
    const res = await fetch("/api/parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: playerName.trim() }),
    });
    const { id } = await res.json();
    setParents((prev) => [...prev, { id, playerName: playerName.trim() }]);
    setPlayerName("");
    setShowForm(false);
    setSaving(false);
  }

  async function del(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/parents/${id}`, { method: "DELETE" });
    setParents((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="選手マスタ" />
      <button
        onClick={() => setShowForm((v) => !v)}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showForm ? "✕ キャンセル" : "＋ 選手を追加"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 grid gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">選手名 *</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="例: けいた"
              className="input"
            />
          </div>
          <button onClick={save} disabled={saving} className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      <div className="grid gap-2">
        {parents.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex justify-between items-center">
            <div className="font-medium text-gray-800">{p.playerName}</div>
            <button onClick={() => del(p.id, p.playerName)} className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-lg">
              削除
            </button>
          </div>
        ))}
        {parents.length === 0 && <p className="text-center text-gray-400 py-8">選手が登録されていません</p>}
      </div>
    </main>
  );
}
