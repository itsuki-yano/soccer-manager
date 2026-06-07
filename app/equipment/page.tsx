"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import BackHeader from "@/components/BackHeader";
import type { Equipment } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved";

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  // 名前・メモ編集
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [nameText, setNameText] = useState("");
  const [editMemoId, setEditMemoId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");

  // 追加
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [showAddTop, setShowAddTop] = useState(false);
  const [newItemName, setNewItemName] = useState("");

  // 写真
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  // 保存状態
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
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

  async function saveName(id: string) {
    if (!nameText.trim()) return;
    const updated = items.find((it) => it.id === id);
    if (!updated) return;
    const next = { ...updated, name: nameText.trim() };
    setItems((prev) => prev.map((it) => it.id === id ? next : it));
    setEditNameId(null);
    await updateItem(next);
  }

  async function saveMemo(id: string) {
    const updated = items.find((it) => it.id === id);
    if (!updated) return;
    const next = { ...updated, memo: memoText };
    setItems((prev) => prev.map((it) => it.id === id ? next : it));
    setEditMemoId(null);
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

  function exitEditMode() {
    setEditMode(false);
    setEditNameId(null);
    setEditMemoId(null);
    setAddingParentId(null);
    setShowAddTop(false);
    setNewItemName("");
  }

  if (loading) return <div className="max-w-lg mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const topItems = items.filter((it) => !it.parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <main className="max-w-lg mx-auto px-4 py-6">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <BackHeader title="備品管理" />
        <button
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          className={`text-sm px-4 py-2 rounded-lg font-medium border transition-colors ${
            editMode
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-blue-600 border-blue-300"
          }`}
        >
          {editMode ? "完了" : "編集"}
        </button>
      </div>

      {/* 編集モード: 備品追加ボタン */}
      {editMode && (
        <div className="mb-4">
          {showAddTop ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-2">
              <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addItem("", newItemName)}
                placeholder="備品名（例: テント大）" className="input flex-1" autoFocus />
              <button onClick={() => addItem("", newItemName)} className="bg-blue-500 text-white px-4 rounded-lg text-sm font-semibold">追加</button>
              <button onClick={() => { setShowAddTop(false); setNewItemName(""); }} className="text-gray-400 px-2">✕</button>
            </div>
          ) : (
            <button
              onClick={() => { setShowAddTop(true); setAddingParentId(null); }}
              className="block w-full bg-blue-500 text-white text-center py-3 rounded-xl font-semibold"
            >
              ＋ 備品を登録
            </button>
          )}
        </div>
      )}

      {/* 一覧 */}
      <div className="grid gap-3">
        {topItems.map((item) => {
          const children = items.filter((it) => it.parentId === item.id).sort((a, b) => a.order - b.order);
          const ss = saveState[item.id];

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 親アイテム */}
              <div className="p-4">
                {/* 写真（編集モード or 写真あり） */}
                {item.imageUrl && (
                  <div className="relative mb-3 group">
                    <Image src={item.imageUrl} alt={item.name} width={400} height={200}
                      className="rounded-lg object-cover w-full max-h-40" />
                    {editMode && (
                      <button onClick={() => removeImage(item.id)}
                        className="absolute top-1 right-1 bg-black/50 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">
                        ✕
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    {/* 名前 */}
                    {editMode && editNameId === item.id ? (
                      <div className="flex gap-2 mb-2">
                        <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveName(item.id)}
                          className="input flex-1" autoFocus />
                        <button onClick={() => saveName(item.id)} className="bg-blue-500 text-white px-3 rounded-lg text-sm">保存</button>
                        <button onClick={() => setEditNameId(null)} className="bg-gray-100 text-gray-600 px-2 rounded-lg text-sm">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-800 text-base">{item.name}</span>
                        {ss === "saving" && <span className="text-xs text-gray-300">保存中…</span>}
                        {ss === "saved" && <span className="text-xs text-green-400">✓</span>}
                        {editMode && (
                          <button onClick={() => { setEditNameId(item.id); setNameText(item.name); setEditMemoId(null); }}
                            className="text-xs text-blue-500 border border-blue-200 px-2 py-0.5 rounded">名前変更</button>
                        )}
                      </div>
                    )}

                    {/* メモ */}
                    {editMode && editMemoId === item.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && saveMemo(item.id)}
                          placeholder="メモ（例: 修理中）" className="input flex-1 text-sm" autoFocus />
                        <button onClick={() => saveMemo(item.id)} className="bg-blue-500 text-white px-2 rounded text-xs">保存</button>
                        <button onClick={() => setEditMemoId(null)} className="bg-gray-100 text-gray-600 px-2 rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.memo && (
                          <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">
                            {item.memo}
                          </span>
                        )}
                        {editMode && (
                          <button onClick={() => { setEditMemoId(item.id); setMemoText(item.memo); setEditNameId(null); }}
                            className={`text-xs px-2 py-0.5 rounded-full border ${
                              item.memo ? "text-yellow-600 border-yellow-200" : "text-gray-400 border-gray-200 border-dashed"
                            }`}>
                            {item.memo ? "メモ変更" : "＋ メモ"}
                          </button>
                        )}
                        {editMode && (
                          <button onClick={() => triggerUpload(item.id)} disabled={uploadingId === item.id}
                            className="text-xs px-2 py-0.5 rounded-full border text-gray-400 border-gray-200 border-dashed disabled:opacity-50">
                            {uploadingId === item.id ? "⏳" : item.imageUrl ? "📷 変更" : "📷 写真"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 数量 */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => changeQty(item.id, -1)}
                      className="w-9 h-9 rounded-full bg-gray-100 text-gray-700 font-bold text-lg flex items-center justify-center active:bg-gray-200">−</button>
                    <span className="w-7 text-center font-bold text-gray-800 text-lg">{item.quantity}</span>
                    <button onClick={() => changeQty(item.id, 1)}
                      className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold text-lg flex items-center justify-center active:bg-blue-200">＋</button>
                  </div>

                  {/* 削除（編集モードのみ） */}
                  {editMode && (
                    <button onClick={() => deleteItem(item.id)} className="text-gray-300 text-xl flex-shrink-0 active:text-red-400 ml-1">✕</button>
                  )}
                </div>
              </div>

              {/* 子アイテム */}
              {(children.length > 0 || (editMode && addingParentId === item.id)) && (
                <div className="border-t border-gray-50 bg-gray-50">
                  {children.map((child) => {
                    const cs = saveState[child.id];
                    return (
                      <div key={child.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300 flex-shrink-0">└</span>
                          <div className="flex-1 min-w-0">
                            {editMode && editNameId === child.id ? (
                              <div className="flex gap-2 mb-1">
                                <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && saveName(child.id)}
                                  className="input flex-1 text-sm" autoFocus />
                                <button onClick={() => saveName(child.id)} className="bg-blue-500 text-white px-2 rounded text-xs">保存</button>
                                <button onClick={() => setEditNameId(null)} className="bg-gray-100 text-gray-600 px-2 rounded text-xs">✕</button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-700">{child.name}</span>
                                {cs === "saving" && <span className="text-xs text-gray-300">…</span>}
                                {cs === "saved" && <span className="text-xs text-green-400">✓</span>}
                                {editMode && (
                                  <button onClick={() => { setEditNameId(child.id); setNameText(child.name); setEditMemoId(null); }}
                                    className="text-xs text-blue-500 border border-blue-200 px-2 py-0.5 rounded">変更</button>
                                )}
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {child.memo && (
                                <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full">{child.memo}</span>
                              )}
                              {editMode && editMemoId === child.id ? (
                                <div className="flex gap-2 flex-1">
                                  <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && saveMemo(child.id)}
                                    placeholder="メモ" className="input flex-1 text-xs" autoFocus />
                                  <button onClick={() => saveMemo(child.id)} className="bg-blue-500 text-white px-2 rounded text-xs">保存</button>
                                  <button onClick={() => setEditMemoId(null)} className="bg-gray-100 px-2 rounded text-xs">✕</button>
                                </div>
                              ) : editMode && (
                                <button onClick={() => { setEditMemoId(child.id); setMemoText(child.memo); setEditNameId(null); }}
                                  className={`text-xs px-2 py-0.5 rounded-full border ${
                                    child.memo ? "text-yellow-600 border-yellow-200" : "text-gray-400 border-gray-200 border-dashed"
                                  }`}>
                                  {child.memo ? "メモ変更" : "＋ メモ"}
                                </button>
                              )}
                              {editMode && (
                                <button onClick={() => triggerUpload(child.id)} disabled={uploadingId === child.id}
                                  className="text-xs px-2 py-0.5 rounded-full border text-gray-400 border-gray-200 border-dashed disabled:opacity-50">
                                  {uploadingId === child.id ? "⏳" : child.imageUrl ? "📷 変更" : "📷 写真"}
                                </button>
                              )}
                            </div>
                            {child.imageUrl && (
                              <div className="relative mt-2 group">
                                <Image src={child.imageUrl} alt={child.name} width={200} height={100}
                                  className="rounded object-cover w-full max-h-24" />
                                {editMode && (
                                  <button onClick={() => removeImage(child.id)}
                                    className="absolute top-1 right-1 bg-black/50 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✕</button>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => changeQty(child.id, -1)}
                              className="w-8 h-8 rounded-full bg-white text-gray-600 font-bold flex items-center justify-center border border-gray-200 active:bg-gray-100">−</button>
                            <span className="w-6 text-center text-sm font-bold text-gray-700">{child.quantity}</span>
                            <button onClick={() => changeQty(child.id, 1)}
                              className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center border border-blue-100 active:bg-blue-100">＋</button>
                          </div>
                          {editMode && (
                            <button onClick={() => deleteItem(child.id)} className="text-gray-300 flex-shrink-0 active:text-red-400 ml-1">✕</button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {editMode && (
                    addingParentId === item.id ? (
                      <div className="px-4 py-2.5 flex gap-2 items-center">
                        <span className="text-gray-300 mr-1">└</span>
                        <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && addItem(item.id, newItemName)}
                          placeholder="アイテム名を入力" className="input flex-1 text-sm" autoFocus />
                        <button onClick={() => addItem(item.id, newItemName)} className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded">追加</button>
                        <button onClick={() => setAddingParentId(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-blue-500 active:bg-gray-100">
                        ＋ {item.name}の中身を登録
                      </button>
                    )
                  )}
                </div>
              )}

              {/* 子なし・編集モード */}
              {children.length === 0 && editMode && addingParentId !== item.id && (
                <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-blue-500 border-t border-gray-50 active:bg-gray-50">
                  ＋ 中身を登録
                </button>
              )}
            </div>
          );
        })}

        {topItems.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400 mb-4">備品が登録されていません</p>
            {!editMode && (
              <button onClick={() => setEditMode(true)}
                className="bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold">
                備品を登録する
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
