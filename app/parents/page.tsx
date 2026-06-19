"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Parent } from "@/lib/types";

type EditForm = { playerName: string; furigana: string; jerseyNumber: string; group: string; carCapacity: string; bucketOrder: string };
const EMPTY_FORM: EditForm = { playerName: "", furigana: "", jerseyNumber: "", group: "", carCapacity: "", bucketOrder: "" };

function FormFields({ f, setter }: { f: EditForm; setter: (v: EditForm) => void }) {
  const setF = (k: keyof EditForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setter({ ...f, [k]: e.target.value });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">選手名（漢字）*</label>
          <input type="text" value={f.playerName} onChange={setF("playerName")} placeholder="例: 矢野慶太" className="input" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">ふりがな</label>
          <input type="text" value={f.furigana} onChange={setF("furigana")} placeholder="例: やのけいた" className="input" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">背番号</label>
          <input type="text" value={f.jerseyNumber} onChange={setF("jerseyNumber")} placeholder="例: 10" className="input" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">班</label>
          <select value={f.group} onChange={setF("group")} className="input">
            <option value="">未設定</option>
            {["1","2","3","4"].map((g) => <option key={g} value={g}>{g}班</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">乗車人数</label>
          <input type="number" min="0" max="9" value={f.carCapacity} onChange={setF("carCapacity")} placeholder="例: 5" className="input" />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-0.5">🪣 バケツ当番の順番</label>
        <input type="number" min="0" value={f.bucketOrder} onChange={setF("bucketOrder")} placeholder="例: 1（数字が小さい順に当番）" className="input" />
        <p className="text-xs text-gray-400 mt-0.5">0または未入力 = 未設定。班順・背番号順とは別の独自順番。</p>
      </div>
    </>
  );
}

export default function ParentsPage() {
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterGroup, setFilterGroup] = useState("全員");
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [sortMode, setSortMode] = useState<"班" | "背番号" | "バケツ当番">("班");

  useEffect(() => {
    fetch("/api/parents").then((r) => r.json()).then((d) => {
      setParents(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  function toParentBody(f: EditForm) {
    return {
      playerName: f.playerName, furigana: f.furigana, jerseyNumber: f.jerseyNumber,
      group: f.group, carCapacity: Number(f.carCapacity) || 0,
      bucketOrder: Number(f.bucketOrder) || 0,
    };
  }

  async function save() {
    if (!form.playerName.trim()) { alert("選手名は必須です"); return; }
    setSaving(true);
    const res = await fetch("/api/parents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toParentBody(form)),
    });
    const { id } = await res.json();
    setParents((prev) => [...prev, { id, ...toParentBody(form) }]);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setSaving(false);
  }

  function startEdit(p: Parent) {
    setEditId(p.id);
    setEditForm({
      playerName: p.playerName, furigana: p.furigana, jerseyNumber: p.jerseyNumber,
      group: p.group, carCapacity: p.carCapacity ? String(p.carCapacity) : "",
      bucketOrder: p.bucketOrder ? String(p.bucketOrder) : "",
    });
  }

  async function saveEdit(id: string) {
    if (!editForm.playerName.trim()) { alert("選手名は必須です"); return; }
    setSaving(true);
    const body = toParentBody(editForm);
    await fetch(`/api/parents/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setParents((prev) => prev.map((p) => p.id === id ? { id, ...body } : p));
    setEditId(null);
    setSaving(false);
  }

  async function del(id: string) {
    await fetch(`/api/parents/${id}`, { method: "DELETE" });
    setParents((prev) => prev.filter((p) => p.id !== id));
    setDeleteConfirm(null);
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const filtered = filterGroup === "全員" ? parents : parents.filter((p) => {
    const g = p.group?.endsWith("班") ? p.group : `${p.group}班`;
    return g === filterGroup;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortMode === "背番号") {
      const na = Number(a.jerseyNumber) || 999, nb = Number(b.jerseyNumber) || 999;
      return na - nb;
    }
    if (sortMode === "バケツ当番") {
      const oa = a.bucketOrder || 999, ob = b.bucketOrder || 999;
      if (oa !== ob) return oa - ob;
      return (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName);
    }
    // 班順（デフォルト）
    const ga = a.group || "9", gb = b.group || "9";
    if (ga !== gb) return ga.localeCompare(gb);
    return (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName);
  });

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="選手マスタ" />
      {deleteConfirm && (
        <DeleteConfirmModal
          message={`「${deleteConfirm.name}」を削除しますか？`}
          onConfirm={() => del(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      <button
        onClick={() => { setShowForm((v) => !v); setEditId(null); }}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showForm ? "✕ キャンセル" : "＋ 選手を追加"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 grid gap-3">
          <FormFields f={form} setter={setForm} />
          <button onClick={save} disabled={saving} className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {/* 並び順選択 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-gray-500 shrink-0">並び順:</span>
        {(["班", "背番号", "バケツ当番"] as const).map((mode) => (
          <button key={mode} onClick={() => setSortMode(mode)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${sortMode === mode ? "bg-gray-800 text-white border-gray-800" : "bg-white text-gray-600 border-gray-200"}`}>
            {mode === "班" ? "🏠 班順" : mode === "背番号" ? "🔢 背番号順" : "🪣 バケツ当番順"}
          </button>
        ))}
      </div>

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
        {sorted.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            {editId === p.id ? (
              <div className="grid gap-3">
                <FormFields f={editForm} setter={setEditForm} />
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
                  {/* 順番インジケーター */}
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    {p.group && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                        {p.group.endsWith("班") ? p.group : `${p.group}班`}
                      </span>
                    )}
                    {p.bucketOrder > 0 && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                        🪣{p.bucketOrder}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono w-5 text-right">{idx + 1}.</span>
                      <span className="font-medium text-gray-800">{p.playerName}</span>
                      {p.jerseyNumber && <span className="text-xs text-gray-400">#{p.jerseyNumber}</span>}
                      {p.carCapacity > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">🚗{p.carCapacity}人</span>
                      )}
                    </div>
                    {p.furigana && <div className="text-xs text-gray-400">{p.furigana}</div>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(p)} className="text-xs text-blue-500 border border-blue-200 px-3 py-1.5 rounded-lg">修正</button>
                  <button onClick={() => setDeleteConfirm({ id: p.id, name: p.playerName })} className="text-xs text-red-400 border border-red-100 px-3 py-1.5 rounded-lg">削除</button>
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
