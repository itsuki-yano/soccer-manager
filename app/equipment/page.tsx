"use client";
import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Equipment } from "@/lib/types";

export default function EquipmentPage() {
  const [items, setItems] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [nameText, setNameText] = useState("");
  const [editMemoId, setEditMemoId] = useState<string | null>(null);
  const [memoText, setMemoText] = useState("");
  const [editQtyId, setEditQtyId] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState("");

  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [showAddTop, setShowAddTop] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; message: string } | null>(null);
  const [newItemName, setNewItemName] = useState("");

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  const [saving, setSaving] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/equipment").then((r) => r.json()).then((d) => {
      setItems(Array.isArray(d) ? d : []);
      setLoading(false);
    });
  }, []);

  async function updateItem(item: Equipment) {
    setSaving((p) => ({ ...p, [item.id]: true }));
    await fetch(`/api/equipment/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    setSaving((p) => ({ ...p, [item.id]: false }));
  }

  async function saveName(id: string) {
    if (!nameText.trim()) return;
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = { ...it, name: nameText.trim() };
    setItems((prev) => prev.map((x) => x.id === id ? next : x));
    setEditNameId(null);
    await updateItem(next);
  }

  async function saveMemo(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = { ...it, memo: memoText };
    setItems((prev) => prev.map((x) => x.id === id ? next : x));
    setEditMemoId(null);
    await updateItem(next);
  }

  async function saveQty(id: string) {
    const val = parseInt(qtyText, 10);
    if (isNaN(val) || val < 0) return;
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = { ...it, quantity: val };
    setItems((prev) => prev.map((x) => x.id === id ? next : x));
    setEditQtyId(null);
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

  function confirmDeleteItem(id: string) {
    const item = items.find((it) => it.id === id);
    const childCount = items.filter((it) => it.parentId === id).length;
    const message = childCount > 0 ? `「${item?.name}」と中身${childCount}件を削除しますか？` : `「${item?.name}」を削除しますか？`;
    setDeleteConfirm({ id, message });
  }

  async function deleteItem(id: string) {
    await fetch(`/api/equipment/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((it) => it.id !== id && it.parentId !== id));
    setDeleteConfirm(null);
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
      const it = items.find((x) => x.id === id);
      if (!it) return;
      const next = { ...it, imageUrl: data.url };
      setItems((prev) => prev.map((x) => x.id === id ? next : x));
      await updateItem(next);
    } finally {
      setUploadingId(null);
    }
  }

  async function removeImage(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = { ...it, imageUrl: "" };
    setItems((prev) => prev.map((x) => x.id === id ? next : x));
    await updateItem(next);
  }

  function exitEditMode() {
    setEditMode(false);
    setEditNameId(null);
    setEditMemoId(null);
    setEditQtyId(null);
    setAddingParentId(null);
    setShowAddTop(false);
    setNewItemName("");
  }

  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const topItems = items.filter((it) => !it.parentId).sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      {deleteConfirm && (
        <DeleteConfirmModal
          message={deleteConfirm.message}
          onConfirm={() => deleteItem(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <BackHeader title="備品管理" />
        <button
          onClick={() => editMode ? exitEditMode() : setEditMode(true)}
          className={`text-sm px-4 py-2 rounded-lg font-medium border transition-colors ${
            editMode ? "bg-gray-800 text-white border-gray-800" : "bg-white text-stone-700 border-stone-300"
          }`}
        >
          {editMode ? "完了" : "編集"}
        </button>
      </div>

      {/* 編集モード: 備品追加 */}
      {editMode && (
        <div className="mb-4">
          {showAddTop ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-2">
              <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&addItem("", newItemName)}
                placeholder="備品名（例: テント大）" className="input flex-1" autoFocus />
              <button onClick={() => addItem("", newItemName)} className="bg-stone-700 text-white px-4 rounded-lg text-sm font-semibold">追加</button>
              <button onClick={() => { setShowAddTop(false); setNewItemName(""); }} className="text-gray-400 px-2">✕</button>
            </div>
          ) : (
            <button onClick={() => { setShowAddTop(true); setAddingParentId(null); }}
              className="block w-full bg-stone-700 text-white text-center py-3 rounded-xl font-semibold">
              ＋ 備品を登録
            </button>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {topItems.map((item) => {
          const children = items.filter((it) => it.parentId === item.id).sort((a, b) => a.order - b.order);
          const isSaving = saving[item.id];

          return (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* 名前 */}
                    {editMode && editNameId === item.id ? (
                      <div className="flex gap-2 mb-2">
                        <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                          onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveName(item.id)}
                          className="input flex-1" autoFocus />
                        <button onClick={() => saveName(item.id)} className="bg-stone-700 text-white px-3 rounded-lg text-sm">保存</button>
                        <button onClick={() => setEditNameId(null)} className="bg-gray-100 text-gray-600 px-2 rounded-lg text-sm">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-800 text-base">{item.name}</span>
                        {isSaving && <span className="text-xs text-gray-300">保存中…</span>}
                        {editMode && (
                          <button onClick={() => { setEditNameId(item.id); setNameText(item.name); setEditMemoId(null); }}
                            className="text-xs text-stone-700 border border-stone-200 px-2 py-0.5 rounded">名前変更</button>
                        )}
                      </div>
                    )}

                    {/* 数量（編集モード） */}
                    {editMode && (
                      editQtyId === item.id ? (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">数量:</span>
                          <input type="number" value={qtyText} onChange={(e) => setQtyText(e.target.value)} min={0}
                            onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveQty(item.id)}
                            className="input w-20 text-sm" autoFocus />
                          <button onClick={() => saveQty(item.id)} className="bg-stone-700 text-white px-2 rounded text-xs">保存</button>
                          <button onClick={() => setEditQtyId(null)} className="text-gray-400 text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditQtyId(item.id); setQtyText(String(item.quantity)); setEditNameId(null); setEditMemoId(null); }}
                          className="text-sm text-gray-600 mb-1 border border-dashed border-gray-200 rounded px-2 py-0.5">
                          数量: {item.quantity}
                        </button>
                      )
                    )}

                    {/* メモ */}
                    {editMode && editMemoId === item.id ? (
                      <div className="flex gap-2">
                        <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                          onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveMemo(item.id)}
                          placeholder="メモ（例: 修理中）" className="input flex-1 text-sm" autoFocus />
                        <button onClick={() => saveMemo(item.id)} className="bg-stone-700 text-white px-2 rounded text-xs">保存</button>
                        <button onClick={() => setEditMemoId(null)} className="bg-gray-100 text-gray-600 px-2 rounded text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.memo && (
                          <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">{item.memo}</span>
                        )}
                        {editMode && (
                          <>
                            <button onClick={() => { setEditMemoId(item.id); setMemoText(item.memo); setEditNameId(null); }}
                              className={`text-xs px-2 py-0.5 rounded-full border ${item.memo ? "text-amber-700 border-amber-200" : "text-gray-400 border-gray-200 border-dashed"}`}>
                              {item.memo ? "メモ変更" : "＋ メモ"}
                            </button>
                            <button onClick={() => triggerUpload(item.id)} disabled={uploadingId === item.id}
                              className="text-xs px-2 py-0.5 rounded-full border text-gray-400 border-gray-200 border-dashed disabled:opacity-50">
                              {uploadingId === item.id ? "⏳" : item.imageUrl ? "📷 変更" : "📷 写真"}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 写真（右側・全体表示） */}
                  {item.imageUrl && (
                    <div className="relative w-24 h-24 flex-shrink-0 bg-gray-50 rounded-lg border border-gray-100">
                      <Image src={item.imageUrl} alt={item.name} fill className="rounded-lg object-contain p-0.5" />
                      {editMode && (
                        <button onClick={() => removeImage(item.id)}
                          className="absolute -top-1.5 -right-1.5 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✕</button>
                      )}
                    </div>
                  )}

                  {/* 数量表示（一覧モード）& 削除ボタン */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!editMode && (
                      <span className="text-lg font-bold text-gray-700 min-w-[2rem] text-right">{item.quantity}</span>
                    )}
                    {editMode && (
                      <button onClick={() => confirmDeleteItem(item.id)} className="text-gray-300 text-xl active:text-red-400">✕</button>
                    )}
                  </div>
                </div>
              </div>

              {/* 子アイテム */}
              {(children.length > 0 || (editMode && addingParentId === item.id)) && (
                <div className="border-t border-gray-50 bg-gray-50">
                  {children.map((child) => (
                    <div key={child.id} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 flex-shrink-0">└</span>
                        <div className="flex-1 min-w-0">
                          {editMode && editNameId === child.id ? (
                            <div className="flex gap-2 mb-1">
                              <input type="text" value={nameText} onChange={(e) => setNameText(e.target.value)}
                                onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveName(child.id)}
                                className="input flex-1 text-sm" autoFocus />
                              <button onClick={() => saveName(child.id)} className="bg-stone-700 text-white px-2 rounded text-xs">保存</button>
                              <button onClick={() => setEditNameId(null)} className="bg-gray-100 text-gray-600 px-2 rounded text-xs">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-700">{child.name}</span>
                              {saving[child.id] && <span className="text-xs text-gray-300">…</span>}
                              {editMode && (
                                <button onClick={() => { setEditNameId(child.id); setNameText(child.name); setEditMemoId(null); }}
                                  className="text-xs text-stone-700 border border-stone-200 px-2 py-0.5 rounded">変更</button>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            {child.memo && (
                              <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">{child.memo}</span>
                            )}
                            {editMode && editMemoId === child.id ? (
                              <div className="flex gap-2 flex-1">
                                <input type="text" value={memoText} onChange={(e) => setMemoText(e.target.value)}
                                  onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveMemo(child.id)}
                                  placeholder="メモ" className="input flex-1 text-xs" autoFocus />
                                <button onClick={() => saveMemo(child.id)} className="bg-stone-700 text-white px-2 rounded text-xs">保存</button>
                                <button onClick={() => setEditMemoId(null)} className="bg-gray-100 px-2 rounded text-xs">✕</button>
                              </div>
                            ) : editMode && (
                              <>
                                <button onClick={() => { setEditMemoId(child.id); setMemoText(child.memo); setEditNameId(null); }}
                                  className={`text-xs px-2 py-0.5 rounded-full border ${child.memo ? "text-amber-700 border-amber-200" : "text-gray-400 border-gray-200 border-dashed"}`}>
                                  {child.memo ? "メモ変更" : "＋ メモ"}
                                </button>
                                <button onClick={() => triggerUpload(child.id)} disabled={uploadingId === child.id}
                                  className="text-xs px-2 py-0.5 rounded-full border text-gray-400 border-gray-200 border-dashed disabled:opacity-50">
                                  {uploadingId === child.id ? "⏳" : child.imageUrl ? "📷 変更" : "📷 写真"}
                                </button>
                              </>
                            )}
                          </div>

                          {/* 子アイテム数量（編集モード） */}
                          {editMode && (
                            editQtyId === child.id ? (
                              <div className="flex items-center gap-2 mt-1">
                                <input type="number" value={qtyText} onChange={(e) => setQtyText(e.target.value)} min={0}
                                  onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&saveQty(child.id)}
                                  className="input w-20 text-sm" autoFocus />
                                <button onClick={() => saveQty(child.id)} className="bg-stone-700 text-white px-2 rounded text-xs">保存</button>
                                <button onClick={() => setEditQtyId(null)} className="text-gray-400 text-xs">✕</button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditQtyId(child.id); setQtyText(String(child.quantity)); setEditNameId(null); setEditMemoId(null); }}
                                className="text-xs text-gray-500 border border-dashed border-gray-200 rounded px-2 py-0.5 mt-1">
                                数量: {child.quantity}
                              </button>
                            )
                          )}

                        </div>

                        {/* 子の写真（右側・全体表示） */}
                        {child.imageUrl && (
                          <div className="relative w-20 h-20 flex-shrink-0 bg-white rounded-lg border border-gray-100">
                            <Image src={child.imageUrl} alt={child.name} fill className="rounded-lg object-contain p-0.5" />
                            {editMode && (
                              <button onClick={() => removeImage(child.id)}
                                className="absolute -top-1.5 -right-1.5 bg-black/60 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">✕</button>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {!editMode && (
                            <span className="text-sm font-bold text-gray-700 min-w-[1.5rem] text-right">{child.quantity}</span>
                          )}
                          {editMode && (
                            <button onClick={() => confirmDeleteItem(child.id)} className="text-gray-300 active:text-red-400">✕</button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {editMode && (
                    addingParentId === item.id ? (
                      <div className="px-4 py-2.5 flex gap-2 items-center">
                        <span className="text-gray-300 mr-1">└</span>
                        <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)}
                          onKeyDown={(e) => !e.nativeEvent.isComposing && e.key === "Enter" &&addItem(item.id, newItemName)}
                          placeholder="アイテム名を入力" className="input flex-1 text-sm" autoFocus />
                        <button onClick={() => addItem(item.id, newItemName)} className="text-xs bg-stone-700 text-white px-3 py-1.5 rounded">追加</button>
                        <button onClick={() => setAddingParentId(null)} className="text-xs text-gray-400">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                        className="w-full text-left px-4 py-2.5 text-sm text-stone-700 active:bg-gray-100">
                        ＋ {item.name}の中身を登録
                      </button>
                    )
                  )}
                </div>
              )}

              {/* 子なし・編集モード */}
              {children.length === 0 && editMode && addingParentId !== item.id && (
                <button onClick={() => { setAddingParentId(item.id); setNewItemName(""); setShowAddTop(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-stone-700 border-t border-gray-50 active:bg-gray-50">
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
              <button onClick={() => setEditMode(true)} className="bg-stone-700 text-white px-6 py-3 rounded-xl font-semibold">
                備品を登録する
              </button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
