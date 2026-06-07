"use client";
import { useEffect, useState, useRef } from "react";
import BackHeader from "@/components/BackHeader";
import type { Equipment } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved";

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMemoId, setEditMemoId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [nameText, setNameText] = useState("");
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [showAddTop, setShowAddTop] = useState(false);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    fetch("/api/equipment").then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  function setSave(id: string, state: SaveState) {
    setSaveState((prev) => ({ ...prev, [id]: state }));
  }

  async function updateItem(item: Equipment) {
    setSave(item.id, "saving");
    await fetch(`/api/equipment/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    setSave(item.id, "saved");
    setTimeout(() => setSave(item.id, "idle"), 1500);
  }

  function changeQty(id: string, delta: number) {
    setItems((prev) => {
      const next = prev.map((it) => it.id === id ? { ...it, quantity: Math.max(0, it.quantity + delta) } : it);
      const updated = next.find((it) => it.id === id)!;
      if (debounceRef.current[id]) clearTimeout(debounceRef.current[id]);
      debounceRef.current[id] = setTimeout(() => updateItem(updated), 600);
      return next;
    });
  }

  function startEditMemo(item: Equipment) {
    setEditMemoId(item.id);
    setMemoText(item.memo);
    setEditNameId(null);
  }

  async function saveMemo(id: string) {
    const updated = items.find((it) => it.id === id);
    if (!updated) return;
    const next = { ...updated, memo: memoText };
    setItems((prev) => prev.map((it) => it.id === id ? next : it));
    setEditMemoId(null);
    await updateItem(next);
  }

  function startEditName(item: Equipment) {
    setEditNameId(item.id);
    setNameText(item.name);
    setEditMemoId(null);
  }

  async function saveName(id: string) {
    if (!nameText.trim()) return;
    const updated = items.find((it) => it.id === id);
    if (!updated) return;
    const next = { ...updated, name: nameText.trim() };
    setItems((prev) => prev.map((it) => it.id === id ? next : it));
    setEditNameId(null);
    await updateItem(next);
  }

  async function addItem(parentId: string, name: string) {
    if (!name.trim()) return;
    const maxOrder = items.filter((it) => it.parentId === parentId).reduce((m, it) => Math.max(m, it.order), 0);
    const res = await fetch("/api/equipment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), quantity: 1, memo: "", parentId, order: maxOrder + 1 }),
    });
    const { id } = await res.json();
    setItems((prev) => [...prev, { id, name: name.trim(), quantity: 1, memo: "", parentId, order: maxOrder + 1 }]);
    setNewItemName("");
    setAddingParentId(null);
    setShowAddTop(false);
  }

  async function deleteItem(id: string) {
    const item = items.find((it) => it.id === id);
    const childCount = items.filter((it) => it.parentId === id).length;
    const msg = childCount > 0
      ? `「${item?.name}」と中身${childCount}件を削除しますか？`
      : `「${item?.name}」を削除しますか？`;
    if (!confirm(msg)) return;
    await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id && it.parentId !== id));
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const topItems = items.filter((it) => !it.parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="備品管理" />

      <button
        onClick={() => { setShowAddTop((v) => !v); setAddingParentId(null); }}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showAddTop ? "✕ キャンセル" : "＋ 備品を追加"}
      </button>

      {showAddTop && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex gap-2">
          <input
            type="text"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem("", newItemName)}
            placeholder="備品名（例: テント大）"
            className="input flex-1"
            autoFocus
          />
          <button
            onClick={() => addItem("", newItemName)}
            className="bg-blue-500 text-white px-4 rounded-lg text-sm font-semibold"
          >
            追加
          </button>
        </div>
      )}

      <div className="grid gap-3">
        {topItems.map((item) => {
          const children = items.filter((it) => it.parentId === item.id).sort((a, b) => a.order - b.order);
          const ss = saveState[item.id];

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 親アイテム */}
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {editNameId === item.id ? (
                      <div className="flex gap-2 mb-1">
                        <input
                          type="text"
                          value={nameText}
                          onChange={(e) => setNameText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveName(item.id)}
                          className="input flex-1 text-sm"
                          autoFocus
                        />
                        <button onClick={() => saveName(item.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                        <button onClick={() => setEditNameId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-800">{item.name}</span>
                        {ss === "saving" && <span className="text-xs text-gray-300">保存中…</span>}
                        {ss === "saved" && <span className="text-xs text-green-400">✓</span>}
                        <button onClick={() => startEditName(item)} className="text-xs text-gray-400 underline">名前変更</button>
                      </div>
                    )}

                    {/* メモ */}
                    {editMemoId === item.id ? (
                      <div className="flex gap-2 mt-1">
                        <input
                          type="text"
                          value={memoText}
                          onChange={(e) => setMemoText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveMemo(item.id)}
                          placeholder="メモ（例: 修理中）"
                          className="input flex-1 text-xs"
                          autoFocus
                        />
                        <button onClick={() => saveMemo(item.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                        <button onClick={() => setEditMemoId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditMemo(item)}
                        className={`text-xs px-2 py-0.5 rounded-full border mt-0.5 ${
                          item.memo
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                            : "text-gray-400 border-gray-200 border-dashed"
                        }`}
                      >
                        {item.memo || "＋ メモ"}
                      </button>
                    )}
                  </div>

                  {/* 数量 */}
                  <div className="flex items-center gap-2 ml-2">
                    <button
                      onClick={() => changeQty(item.id, -1)}
                      className="w-8 h-8 rounded-full bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200"
                    >−</button>
                    <span className="w-6 text-center font-semibold text-gray-800">{item.quantity}</span>
                    <button
                      onClick={() => changeQty(item.id, 1)}
                      className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center active:bg-blue-200"
                    >＋</button>
                  </div>

                  <button onClick={() => deleteItem(item.id)} className="text-gray-300 text-lg ml-1 active:text-red-400">✕</button>
                </div>
              </div>

              {/* 子アイテム */}
              {(children.length > 0 || addingParentId === item.id) && (
                <div className="border-t border-gray-50 bg-gray-50">
                  {children.map((child) => {
                    const css = saveState[child.id];
                    return (
                      <div key={child.id} className="px-4 py-2.5 flex items-center gap-2 border-b border-gray-100 last:border-0">
                        <span className="text-gray-300 mr-1">└</span>
                        <div className="flex-1 min-w-0">
                          {editNameId === child.id ? (
                            <div className="flex gap-2">
                              <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveName(child.id)}
                                className="input flex-1 text-sm" autoFocus />
                              <button onClick={() => saveName(child.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                              <button onClick={() => setEditNameId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">{child.name}</span>
                              {css === "saving" && <span className="text-xs text-gray-300">…</span>}
                              {css === "saved" && <span className="text-xs text-green-400">✓</span>}
                              <button onClick={() => startEditName(child)} className="text-xs text-gray-400 underline">変更</button>
                            </div>
                          )}
                          {editMemoId === child.id ? (
                            <div className="flex gap-2 mt-1">
                              <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && saveMemo(child.id)}
                                placeholder="メモ（例: 修理中）" className="input flex-1 text-xs" autoFocus />
                              <button onClick={() => saveMemo(child.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                              <button onClick={() => setEditMemoId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEditMemo(child)}
                              className={`text-xs px-2 py-0.5 rounded-full border ${
                                child.memo ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "text-gray-400 border-gray-200 border-dashed"
                              }`}>
                              {child.memo || "＋ メモ"}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => changeQty(child.id, -1)}
                            className="w-7 h-7 rounded-full bg-white text-gray-600 font-bold flex items-center justify-center border border-gray-200 active:bg-gray-100">−</button>
                          <span className="w-5 text-center text-sm font-semibold text-gray-700">{child.quantity}</span>
                          <button onClick={() => changeQty(child.id, 1)}
                            className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center border border-blue-100 active:bg-blue-100">＋</button>
                        </div>
                        <button onClick={() => deleteItem(child.id)} className="text-gray-300 active:text-red-400 ml-1">✕</button>
                      </div>
                    );
                  })}

                  {addingParentId === item.id ? (
                    <div className="px-4 py-2.5 flex gap-2 items-center">
                      <span className="text-gray-300 mr-1">└</span>
                      <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addItem(item.id, newItemName)}
                        placeholder="アイテム名（例: ガーゼパット）"
                        className="input flex-1 text-sm" autoFocus />
                      <button onClick={() => addItem(item.id, newItemName)} className="text-xs bg-blue-500 text-white px-2 py-1.5 rounded">追加</button>
                      <button onClick={() => setAddingParentId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-400 active:bg-gray-100"
                    >
                      ＋ {item.name}の中身を追加
                    </button>
                  )}
                </div>
              )}

              {/* 子アイテムがない場合も「中身追加」ボタン */}
              {children.length === 0 && addingParentId !== item.id && (
                <button
                  onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-400 border-t border-gray-50 active:bg-gray-50"
                >
                  ＋ 中身を追加
                </button>
              )}
            </div>
          );
        })}

        {topItems.length === 0 && !showAddTop && (
          <p className="text-center text-gray-400 py-8">備品が登録されていません</p>
        )}
      </div>
    </main>
  );
}
