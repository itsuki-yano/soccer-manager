"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
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
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const debounceRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

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
      body: JSON.stringify({ name: name.trim(), quantity: 1, memo: "", parentId, order: maxOrder + 1, imageUrl: "" }),
    });
    const { id } = await res.json();
    setItems((prev) => [...prev, { id, name: name.trim(), quantity: 1, memo: "", parentId, order: maxOrder + 1, imageUrl: "" }]);
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

  function triggerUpload(id: string) {
    uploadTargetId.current = id;
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetId.current;
    if (!file || !id) return;
    e.target.value = "";
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/equipment/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.url) { alert("アップロードに失敗しました"); return; }
      const updated = items.find((it) => it.id === id);
      if (!updated) return;
      const next = { ...updated, imageUrl: data.url };
      setItems((prev) => prev.map((it) => it.id === id ? next : it));
      await updateItem(next);
    } finally {
      setUploadingId(null);
    }
  }

  async function removeImage(id: string) {
    const updated = items.find((it) => it.id === id);
    if (!updated) return;
    const next = { ...updated, imageUrl: "" };
    setItems((prev) => prev.map((it) => it.id === id ? next : it));
    await updateItem(next);
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const topItems = items.filter((it) => !it.parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  function ItemRow({ item, isChild }: { item: Equipment; isChild?: boolean }) {
    const ss = saveState[item.id];
    return (
      <div className={isChild ? "px-4 py-2.5 border-b border-gray-100 last:border-0" : "p-4"}>
        {/* 写真 */}
        {item.imageUrl && (
          <div className="relative mb-2 group">
            <Image src={item.imageUrl} alt={item.name} width={200} height={120}
              className="rounded-lg object-cover w-full max-h-32" />
            <button onClick={() => removeImage(item.id)}
              className="absolute top-1 right-1 bg-black/50 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100">
              ✕
            </button>
          </div>
        )}

        <div className={`flex items-start gap-2 ${isChild ? "" : ""}`}>
          {isChild && <span className="text-gray-300 mt-1 flex-shrink-0">└</span>}
          <div className="flex-1 min-w-0">
            {editNameId === item.id ? (
              <div className="flex gap-2 mb-1">
                <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName(item.id)}
                  className="input flex-1 text-sm" autoFocus />
                <button onClick={() => saveName(item.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                <button onClick={() => setEditNameId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`${isChild ? "text-sm text-gray-700" : "font-semibold text-gray-800"}`}>{item.name}</span>
                {ss === "saving" && <span className="text-xs text-gray-300">保存中…</span>}
                {ss === "saved" && <span className="text-xs text-green-400">✓</span>}
                <button onClick={() => startEditName(item)} className="text-xs text-gray-400 underline">変更</button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              {editMemoId === item.id ? (
                <div className="flex gap-2 flex-1">
                  <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveMemo(item.id)}
                    placeholder="メモ（例: 修理中）" className="input flex-1 text-xs" autoFocus />
                  <button onClick={() => saveMemo(item.id)} className="text-xs bg-blue-500 text-white px-2 rounded">保存</button>
                  <button onClick={() => setEditMemoId(null)} className="text-xs bg-gray-100 text-gray-600 px-2 rounded">✕</button>
                </div>
              ) : (
                <button onClick={() => startEditMemo(item)}
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    item.memo ? "bg-yellow-50 text-yellow-700 border-yellow-200" : "text-gray-400 border-gray-200 border-dashed"
                  }`}>
                  {item.memo || "＋ メモ"}
                </button>
              )}

              {/* 写真ボタン */}
              <button
                onClick={() => triggerUpload(item.id)}
                disabled={uploadingId === item.id}
                className="text-xs px-2 py-0.5 rounded-full border text-gray-400 border-gray-200 border-dashed disabled:opacity-50"
              >
                {uploadingId === item.id ? "⏳" : item.imageUrl ? "📷 変更" : "📷 写真"}
              </button>
            </div>
          </div>

          {/* 数量 */}
          <div className={`flex items-center gap-${isChild ? "1.5" : "2"} flex-shrink-0`}>
            <button onClick={() => changeQty(item.id, -1)}
              className={`${isChild ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-gray-100 text-gray-700 font-bold flex items-center justify-center active:bg-gray-200`}>
              −
            </button>
            <span className={`${isChild ? "w-5 text-sm" : "w-6"} text-center font-semibold text-gray-800`}>{item.quantity}</span>
            <button onClick={() => changeQty(item.id, 1)}
              className={`${isChild ? "w-7 h-7" : "w-8 h-8"} rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center active:bg-blue-200`}>
              ＋
            </button>
          </div>

          <button onClick={() => deleteItem(item.id)} className="text-gray-300 text-lg flex-shrink-0 active:text-red-400">✕</button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <BackHeader title="備品管理" />

      {/* hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <button
        onClick={() => { setShowAddTop((v) => !v); setAddingParentId(null); }}
        className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold mb-4"
      >
        {showAddTop ? "✕ キャンセル" : "＋ 備品を追加"}
      </button>

      {showAddTop && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex gap-2">
          <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem("", newItemName)}
            placeholder="備品名（例: テント大）" className="input flex-1" autoFocus />
          <button onClick={() => addItem("", newItemName)}
            className="bg-blue-500 text-white px-4 rounded-lg text-sm font-semibold">追加</button>
        </div>
      )}

      <div className="grid gap-3">
        {topItems.map((item) => {
          const children = items.filter((it) => it.parentId === item.id).sort((a, b) => a.order - b.order);
          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <ItemRow item={item} />

              {(children.length > 0 || addingParentId === item.id) && (
                <div className="border-t border-gray-50 bg-gray-50">
                  {children.map((child) => (
                    <ItemRow key={child.id} item={child} isChild />
                  ))}
                  {addingParentId === item.id ? (
                    <div className="px-4 py-2.5 flex gap-2 items-center">
                      <span className="text-gray-300 mr-1">└</span>
                      <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addItem(item.id, newItemName)}
                        placeholder="アイテム名" className="input flex-1 text-sm" autoFocus />
                      <button onClick={() => addItem(item.id, newItemName)} className="text-xs bg-blue-500 text-white px-2 py-1.5 rounded">追加</button>
                      <button onClick={() => setAddingParentId(null)} className="text-xs text-gray-400">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-gray-400 active:bg-gray-100">
                      ＋ {item.name}の中身を追加
                    </button>
                  )}
                </div>
              )}

              {children.length === 0 && addingParentId !== item.id && (
                <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-gray-400 border-t border-gray-50 active:bg-gray-50">
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
