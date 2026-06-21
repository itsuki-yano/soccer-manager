"use client";
import { useEffect, useState } from "react";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Parent } from "@/lib/types";

type EditForm = {
  playerName: string; furigana: string;
  jerseyNumber: string; uniformNumber: string;
  group: string; carCapacity: string; bucketOrder: string;
};
const EMPTY_FORM: EditForm = {
  playerName: "", furigana: "", jerseyNumber: "", uniformNumber: "",
  group: "", carCapacity: "", bucketOrder: "",
};

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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">ユニフォーム番号</label>
          <input type="text" value={f.uniformNumber} onChange={setF("uniformNumber")} placeholder="例: 10" className="input" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">練習着番号</label>
          <input type="text" value={f.jerseyNumber} onChange={setF("jerseyNumber")} placeholder="例: 51" className="input" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
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
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">🪣 当番順</label>
          <input type="number" min="0" value={f.bucketOrder} onChange={setF("bucketOrder")} placeholder="例: 1" className="input" />
        </div>
      </div>
    </>
  );
}

const MASTER_PASSWORD = "0404";

function PasswordModal({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);
  function attempt() {
    if (pw === MASTER_PASSWORD) { onSuccess(); }
    else { setError(true); setPw(""); }
  }
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 className="text-base font-bold text-gray-800 mb-2">編集パスワード</h3>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          マスタ修正は諒ママで代行いたします。ご連絡ください。
        </p>
        <input
          type="password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(false); }}
          onKeyDown={(e) => e.key === "Enter" && attempt()}
          placeholder="パスワードを入力"
          className="input w-full mb-2"
          autoFocus
        />
        {error && <p className="text-xs text-red-500 mb-2">パスワードが違います</p>}
        <div className="flex gap-2 mt-3">
          <button onClick={attempt} className="flex-1 bg-stone-700 text-white py-2.5 rounded-xl font-semibold text-sm">確認</button>
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-semibold text-sm">キャンセル</button>
        </div>
      </div>
    </div>
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
  const [pwModal, setPwModal] = useState<null | (() => void)>(null);

  useEffect(() => {
    fetch("/api/parents").then((r) => r.json()).then((d) => {
      setParents(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  function toParentBody(f: EditForm) {
    return {
      playerName: f.playerName, furigana: f.furigana,
      jerseyNumber: f.jerseyNumber, uniformNumber: f.uniformNumber,
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
      playerName: p.playerName, furigana: p.furigana,
      jerseyNumber: p.jerseyNumber, uniformNumber: p.uniformNumber ?? "",
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
      const na = Number(a.uniformNumber || a.jerseyNumber) || 999;
      const nb = Number(b.uniformNumber || b.jerseyNumber) || 999;
      return na - nb;
    }
    if (sortMode === "バケツ当番") {
      const oa = a.bucketOrder || 999, ob = b.bucketOrder || 999;
      if (oa !== ob) return oa - ob;
      return (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName);
    }
    const ga = a.group || "9", gb = b.group || "9";
    if (ga !== gb) return ga.localeCompare(gb);
    return (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName);
  });

  function withPassword(action: () => void) {
    setPwModal(() => action);
  }

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="選手マスタ" />
      {pwModal && (
        <PasswordModal
          onSuccess={() => { const fn = pwModal; setPwModal(null); fn(); }}
          onCancel={() => setPwModal(null)}
        />
      )}
      {deleteConfirm && (
        <DeleteConfirmModal
          message={`「${deleteConfirm.name}」を削除しますか？`}
          onConfirm={() => del(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      <button
        onClick={() => withPassword(() => { setShowForm((v) => !v); setEditId(null); })}
        className="block w-full bg-stone-700 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showForm ? "✕ キャンセル" : "＋ 選手を追加"}
      </button>

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-4 mb-4 grid gap-3">
          <FormFields f={form} setter={setForm} />
          <button onClick={save} disabled={saving} className="w-full bg-stone-700 text-white py-2.5 rounded-lg font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      )}

      {/* 並び順 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="text-xs text-stone-500 shrink-0">並び順:</span>
        {(["班", "背番号", "バケツ当番"] as const).map((mode) => (
          <button key={mode} onClick={() => setSortMode(mode)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${sortMode === mode ? "bg-stone-700 text-white border-stone-700" : "bg-white text-stone-600 border-stone-300"}`}>
            {mode === "班" ? "🏠 班順" : mode === "背番号" ? "🔢 背番号順" : "🪣 バケツ当番順"}
          </button>
        ))}
      </div>

      {/* 班フィルター */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {["全員", "1班", "2班", "3班", "4班"].map((g) => (
          <button key={g} onClick={() => setFilterGroup(g)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              filterGroup === g ? "bg-amber-700 text-white border-amber-700" : "bg-white text-stone-600 border-stone-300"
            }`}>{g}</button>
        ))}
      </div>

      <div className="grid gap-2">
        {sorted.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm border border-stone-100 p-3">
            {editId === p.id ? (
              <div className="grid gap-3">
                <FormFields f={editForm} setter={setEditForm} />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(p.id)} disabled={saving}
                    className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                    {saving ? "保存中..." : "保存"}
                  </button>
                  <button onClick={() => setEditId(null)} className="flex-1 bg-stone-100 text-stone-600 py-2 rounded-lg text-sm font-semibold">
                    キャンセル
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* 班・バケツバッジ */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-10">
                  {p.group && (
                    <span className="text-xs bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-md font-semibold border border-amber-200 w-full text-center">
                      {p.group.endsWith("班") ? p.group : `${p.group}班`}
                    </span>
                  )}
                  {p.bucketOrder > 0 && (
                    <span className="text-xs bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-md font-semibold border border-stone-300 w-full text-center">
                      🪣{p.bucketOrder}
                    </span>
                  )}
                </div>

                {/* 番号・選手情報 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-stone-400 font-mono shrink-0">{idx + 1}.</span>
                    {p.uniformNumber && (
                      <span className="text-lg font-bold text-stone-800 shrink-0">#{p.uniformNumber}</span>
                    )}
                    <span className="font-bold text-stone-800 text-base whitespace-nowrap overflow-hidden text-ellipsis">
                      {p.playerName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.furigana && <span className="text-xs text-stone-400">{p.furigana}</span>}
                    {p.jerseyNumber && (
                      <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200">
                        練習着#{p.jerseyNumber}
                      </span>
                    )}
                    {p.carCapacity > 0 && (
                      <span className="text-xs bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                        🚗{p.carCapacity}人
                      </span>
                    )}
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => withPassword(() => startEdit(p))} className="text-xs text-stone-600 border border-stone-300 px-2.5 py-1.5 rounded-lg">修正</button>
                  <button onClick={() => withPassword(() => setDeleteConfirm({ id: p.id, name: p.playerName }))} className="text-xs text-red-400 border border-red-100 px-2.5 py-1.5 rounded-lg">削除</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && <p className="text-center text-stone-400 py-8">該当する選手がいません</p>}
      </div>
    </main>
  );
}
