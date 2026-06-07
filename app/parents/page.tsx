"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import type { Parent } from "@/lib/types";

type EditForm = { playerName: string; furigana: string; jerseyNumber: string; group: string };

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterGroup, setFilterGroup] = useState("全員");
  const [form, setForm] = useState<EditForm>({ playerName: "", furigana: "", jerseyNumber: "", group: "" });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ playerName: "", furigana: "", jerseyNumber: "", group: "" });

  useEffect(() => {
    fetch("/api/parents").then((r) => r.json()).then((d) => {
      setParents(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  const setF = (k: keyof EditForm, target: EditForm, setter: (f: EditForm) => void) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setter({ ...target, [k]: e.target.value });

  async function save() {
    if (!form.playerName.trim()) { alert("選手名は必須です"); return; }
    setSaving(true);
    const res = await fetch("/api/parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const { id } = await res.json();
    setParents((prev) => [...prev, { id, ...form }]);
    setForm({ playerName: "", furigana: "", jerseyNumber: "", group: "" });
    setShowForm(false);
    setSaving(false);
  }

  function startEdit(p: Parent) {
    setEditId(p.id);
    setEditForm({ playerName: p.playerName, furigana: p.furigana, jerseyNumber: p.jerseyNumber, group: p.group });
  }

  async function saveEdit(id: string) {
    if (!editForm.playerName.trim()) { alert("選手名は必須です"); return; }
    setSaving(true);
    await fetch(`/api/parents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setParents((prev) => prev.map((p) => p.id === id ? { id, ...editForm } : p));
    setEditId(null);
    setSaving(false);
  }

  async function del(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return;
    await fetch(`/api/parents/${id}`, { method: "DELETE" });
    setParents((prev) => prev.filter((p) => p.id !== id));
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const filtered = filterGroup === "全員" ? parents : parents.filter((p) => {
    const g = filterGroup.replace("班", "");
    return p.group === g;
  });
  const sorted = [...filtered].sort((a, b) => {
    const ga = a.group || "9", gb = b.group || "9";
    if (ga !== gb) return ga.localeCompare(gb);
    return (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName);
  });

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="選手マスタ" />
      <button
        onClick={() => { setShowForm((v) => !v); setEditId(null); }}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showForm ? "✕ キャンセル" : "＋ 選手を追加"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">選手名（漢字）*</label>
              <input type="text" value={form.playerName} onChange={setF("playerName", form, setForm)} placeholder="例: 矢野慶太" className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">ふりがな</label>
              <input type="text" value={form.furigana} onChange={setF("furigana", form, setForm)} placeholder="例: やのけいた" className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">背番号</label>
              <input type="text" value={form.jerseyNumber} onChange={setF("jerseyNumber", form, setForm)} placeholder="例: 10" className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">班</label>
              <select value={form.group} onChange={setF("group", form, setForm)} className="input">
                <option value="">未設定</option>
                {["1","2","3","4"].map((g) => <option key={g} value={g}>{g}班</option>)}
              </select>
            </div>
          </div>
          <button onClick={save} disabled={saving} className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {/* 班フィルター */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {["全員", "1班", "2班", "3班", "4班"].map((g) => (
          <button key={g} onClick={() => setFilterGroup(g)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterGroup === g ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-600 border-gray-200"
            }`}>{g}</button>
        ))}
      </div>

      <div className="grid gap-2">
        {sorted.map((p) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {editId === p.id ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">選手名（漢字）*</label>
                    <input type="text" value={editForm.playerName} onChange={setF("playerName", editForm, setEditForm)} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">ふりがな</label>
                    <input type="text" value={editForm.furigana} onChange={setF("furigana", editForm, setEditForm)} className="input" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">背番号</label>
                    <input type="text" value={editForm.jerseyNumber} onChange={setF("jerseyNumber", editForm, setEditForm)} className="input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">班</label>
                    <select value={editForm.group} onChange={setF("group", editForm, setEditForm)} className="input">
                      <option value="">未設定</option>
                      {["1","2","3","4"].map((g) => <option key={g} value={g}>{g}班</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(p.id)} disabled={saving}
                    className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button onClick={() => setEditId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm font-semibold">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {p.group && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium w-8 text-center">
                      {p.group}班
                    </span>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">{p.playerName}</span>
                      {p.jerseyNumber && <span className="text-xs text-gray-400">#{p.jerseyNumber}</span>}
                    </div>
                    {p.furigana && <div className="text-xs text-gray-400">{p.furigana}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg">
                    修正
                  </button>
                  <button onClick={() => del(p.id, p.playerName)} className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-lg">
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-gray-400 py-8">該当する選手がいません</p>}
      </div>
    </main>
  );
}
