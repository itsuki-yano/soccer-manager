"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import type { Practice, BucketDuty, Settings } from "@/lib/types";

type View = "list" | "cal";

const TYPE_COLORS: Record<string, string> = {
  "通常練習": "bg-stone-100 text-stone-700",
  "自主練習": "bg-emerald-100 text-emerald-800",
};

const PRACTICE_TYPES = ["通常練習", "自主練習"];

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${d.replace(/-/g, "/")}（${DOW[dt.getDay()]}）`;
}

function isBucketActive(practice: Practice, start: string, end: string): boolean {
  if (practice.type !== "自主練習") return false;
  const dow = new Date(practice.date + "T00:00:00").getDay();
  if (dow !== 6) return false; // 土曜日のみ
  if (!start || !end) return true; // 期間未設定の場合は全て対象
  return practice.date >= start && practice.date <= end;
}

function BucketDutyCard({
  practice,
  duty,
  bucketActive,
}: {
  practice: Practice;
  duty: BucketDuty | null;
  bucketActive: boolean;
}) {
  if (!bucketActive) return null;

  return (
    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-amber-800">🪣 バケツ当番</span>
        <Link
          href={`/duty-roster?practiceId=${practice.id}`}
          className="text-xs text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-1 rounded-lg font-medium"
        >
          当番一覧で設定 →
        </Link>
      </div>
      {duty ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
            <div className="text-xs text-stone-500 mb-0.5">持っていく</div>
            <div className="text-sm font-semibold text-stone-800">{duty.bringPersonName || "未設定"}</div>
          </div>
          <div className="bg-stone-50 border border-stone-200 rounded-lg p-2 text-center">
            <div className="text-xs text-stone-500 mb-0.5">持って帰る</div>
            <div className="text-sm font-semibold text-stone-800">{duty.returnPersonName || "未設定"}</div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-amber-700 text-center py-1">バケツ当番が未設定です</p>
      )}
    </div>
  );
}

export default function PracticesPage() {
  const [practices, setPractices] = useState<Practice[]>([]);
  const [duties, setDuties] = useState<BucketDuty[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [syncing, setSyncing] = useState(false);
  const [bandEvents, setBandEvents] = useState<Omit<Practice, "id">[]>([]);
  const [showBand, setShowBand] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importingAll, setImportingAll] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; date: string } | null>(null);
  // BANDで削除された練習（アプリからも削除する候補）
  const [pendingDeletes, setPendingDeletes] = useState<Practice[]>([]);
  const [deletingBand, setDeletingBand] = useState(false);
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [form, setForm] = useState({ date: "", type: "通常練習", venue: "", address: "", startTime: "", endTime: "" });
  // 練習の編集
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ type: "通常練習", date: "", venue: "", address: "", startTime: "", endTime: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  function startEditPractice(p: Practice) {
    setEditId(p.id);
    setEditForm({ type: p.type, date: p.date, venue: p.venue, address: p.address ?? "", startTime: p.startTime, endTime: p.endTime });
  }

  async function saveEditPractice(id: string) {
    setSavingEdit(true);
    await fetch(`/api/practices/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setPractices((prev) => prev.map((p) => p.id === id ? { ...p, ...editForm } : p));
    setEditId(null);
    setSavingEdit(false);
  }

  const load = useCallback(async () => {
    const [ps, ds, st] = await Promise.all([
      fetch("/api/practices").then((r) => r.json()),
      fetch("/api/bucket-duties").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setPractices(Array.isArray(ps) ? ps : []);
    setDuties(Array.isArray(ds) ? ds : []);
    setSettings(st);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncBand() {
    setSyncing(true);
    const res = await fetch("/api/band-practices");
    const data = await res.json();
    if (Array.isArray(data)) {
      const existing = practices.map((p) => p.bandUid).filter(Boolean);
      setBandEvents(data.filter((e: Practice) => !existing.includes(e.bandUid)));
      setShowBand(true);
      // BAND側で削除された練習を検出（BAND由来かつ未来で、最新フィードに存在しないもの）
      const feedUids = new Set<string>(data.map((e: Practice) => e.bandUid));
      const t = new Date().toISOString().slice(0, 10);
      const gone = practices.filter((p) => p.bandUid && p.date >= t && !feedUids.has(p.bandUid));
      setPendingDeletes(gone);
    }
    setSyncing(false);
  }

  // BANDで削除された練習をアプリからも削除（紐付くバケツ当番も連動削除）
  async function confirmBandDeletes() {
    setDeletingBand(true);
    try {
      for (const p of pendingDeletes) {
        await fetch(`/api/bucket-duties?practiceId=${encodeURIComponent(p.id)}`, { method: "DELETE" });
        await fetch(`/api/practices/${p.id}`, { method: "DELETE" });
      }
      const goneIds = new Set(pendingDeletes.map((p) => p.id));
      setPractices((prev) => prev.filter((p) => !goneIds.has(p.id)));
      setDuties((prev) => prev.filter((d) => !goneIds.has(d.practiceId)));
      setPendingDeletes([]);
    } finally {
      setDeletingBand(false);
    }
  }

  async function importEvent(ev: Omit<Practice, "id">) {
    const res = await fetch("/api/practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ev),
    });
    const data = await res.json();
    if (!data.id) { alert("登録に失敗しました"); return; }
    setPractices((prev) => [...prev, { id: data.id, ...ev }].sort((a, b) => a.date.localeCompare(b.date)));
    setBandEvents((prev) => prev.filter((e) => e.bandUid !== ev.bandUid));
  }

  async function importAll() {
    setImportingAll(true);
    const toImport = [...bandEvents];
    const added: Practice[] = [];
    for (const ev of toImport) {
      const res = await fetch("/api/practices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ev),
      });
      const data = await res.json();
      if (data.id) added.push({ id: data.id, ...ev });
    }
    setPractices((prev) => [...prev, ...added].sort((a, b) => a.date.localeCompare(b.date)));
    setBandEvents((prev) => prev.filter((e) => !added.some((a) => a.bandUid === e.bandUid)));
    setImportingAll(false);
  }

  async function addPractice() {
    if (!form.date) return;
    setSaving(true);
    const body = { ...form, bandUid: "" };
    const res = await fetch("/api/practices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.id) {
      setPractices((prev) => [...prev, { id: data.id, ...body }].sort((a, b) => a.date.localeCompare(b.date)));
      setForm({ date: "", type: "通常練習", venue: "", address: "", startTime: "", endTime: "" });
      setShowForm(false);
    } else {
      alert("追加に失敗しました");
    }
    setSaving(false);
  }

  async function deletePractice(id: string) {
    // 紐付くバケツ当番(bucket-duties)も解除してから練習を削除
    await fetch(`/api/bucket-duties?practiceId=${encodeURIComponent(id)}`, { method: "DELETE" });
    await fetch(`/api/practices/${id}`, { method: "DELETE" });
    setPractices((prev) => prev.filter((p) => p.id !== id));
    setDuties((prev) => prev.filter((d) => d.practiceId !== id));
    setDeleteConfirm(null);
  }


  if (loading) return <div className="max-w-lg md:max-w-4xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const today = new Date().toISOString().slice(0, 10);
  const bucketStart = settings?.bucketDutyStartDate ?? "";
  const bucketEnd = settings?.bucketDutyEndDate ?? "";
  const sorted = [...practices].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((p) => p.date >= today);
  const past = sorted.filter((p) => p.date < today).reverse();

  // カレンダー用
  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const practiceMap: Record<string, Practice[]> = {};
  practices.forEach((p) => {
    if (!practiceMap[p.date]) practiceMap[p.date] = [];
    practiceMap[p.date].push(p);
  });

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="通常練習" />

      {/* BAND削除予定の連動削除モーダル */}
      {pendingDeletes.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm">
            <div className="text-center mb-3">
              <div className="text-4xl mb-2">🗑️</div>
              <h2 className="text-lg font-bold text-gray-800">BANDで削除された練習</h2>
              <p className="text-sm text-gray-600 mt-2">
                以下の{pendingDeletes.length}件はBAND側で削除されています。<br />
                アプリからも削除しますか？<br />
                <span className="text-xs text-gray-400">（紐付くバケツ当番も一緒に削除されます）</span>
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto border border-gray-100 rounded-lg p-2 mb-4 space-y-1">
              {pendingDeletes.map((p) => (
                <div key={p.id} className="text-sm text-gray-700">
                  <span className="text-gray-400">{fmtDate(p.date)}</span>　{p.type}{p.venue ? ` @ ${p.venue}` : ""}
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <button onClick={confirmBandDeletes} disabled={deletingBand} className="w-full bg-red-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
                {deletingBand ? "削除中..." : `${pendingDeletes.length}件を削除する`}
              </button>
              <button onClick={() => setPendingDeletes([])} disabled={deletingBand} className="w-full text-gray-500 py-2 text-sm">
                削除しない（残す）
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <DeleteConfirmModal
          message={`${deleteConfirm.date}の練習を削除しますか？`}
          onConfirm={() => deletePractice(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}

      {/* アクションバー */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={syncBand}
          disabled={syncing}
          className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
        >
          {syncing ? "同期中..." : "🎵 BAND同期"}
        </button>
        <button
          onClick={() => { setShowForm((v) => !v); setShowBand(false); }}
          className="flex-1 bg-stone-700 text-white py-2.5 rounded-xl text-sm font-semibold"
        >
          {showForm ? "✕ キャンセル" : "＋ 手動追加"}
        </button>
        <div className="flex bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
          {(["list", "cal"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-2.5 text-sm font-medium transition-colors ${view === v ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
            >
              {v === "list" ? "一覧" : "カレンダー"}
            </button>
          ))}
        </div>
      </div>

      {/* 手動追加フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 grid gap-3">
          <div className="grid grid-cols-2 gap-2">
            {PRACTICE_TYPES.map((t) => (
              <button key={t} type="button" onClick={() => setForm((f) => ({ ...f, type: t }))}
                className={`py-2 rounded-lg text-sm font-medium border transition-colors ${form.type === t ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{t}</button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">日付 *</label>
            <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="input" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">練習場名</label>
            <input type="text" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} placeholder="例: かりがね小学校" className="input" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">住所</label>
            <input type="text" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="例: 愛知県刈谷市築地町2-15-1" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">開始時間</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} className="input" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">終了時間</label>
              <input type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} className="input" />
            </div>
          </div>
          <button onClick={addPractice} disabled={saving || !form.date} className="w-full bg-stone-700 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
            {saving ? "保存中..." : "追加"}
          </button>
        </div>
      )}

      {/* BAND取得結果 */}
      {showBand && bandEvents.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-emerald-800">BANDから {bandEvents.length}件 取得</p>
            <button
              onClick={importAll}
              disabled={importingAll}
              className="text-xs bg-emerald-700 text-white px-4 py-1.5 rounded-lg font-semibold disabled:opacity-50"
            >
              {importingAll ? "登録中..." : "一括登録"}
            </button>
          </div>
          <div className="grid gap-2">
            {bandEvents.map((ev, i) => (
              <div key={i} className="bg-white rounded-lg p-3 border border-emerald-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[ev.type] ?? "bg-gray-100 text-gray-600"}`}>{ev.type}</span>
                    <span className="text-sm font-medium text-gray-800">{fmtDate(ev.date)}</span>
                  </div>
                  <button onClick={() => importEvent(ev)} disabled={importingAll} className="text-xs bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40">登録</button>
                </div>
                <input
                  type="text"
                  value={ev.venue}
                  onChange={(e) => setBandEvents((prev) => prev.map((x, j) => j === i ? { ...x, venue: e.target.value } : x))}
                  placeholder="会場を入力（例: かりがね小学校）"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-300"
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {showBand && bandEvents.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-sm text-emerald-800 text-center">新しい練習はありません</div>
      )}

      {/* リスト表示 */}
      {view === "list" && (
        <>
          {upcoming.length === 0 && past.length === 0 && (
            <div className="text-center text-gray-400 py-12">練習が登録されていません<br /><span className="text-sm">BAND同期または手動追加してください</span></div>
          )}
          {upcoming.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-400 mb-2">今後の練習</p>
              {upcoming.map((p) => {
                const duty = duties.find((d) => d.practiceId === p.id) ?? null;
                const active = isBucketActive(p, bucketStart, bucketEnd);
                return (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-600"}`}>{p.type}</span>
                        <span className="font-semibold text-gray-800">{fmtDate(p.date)}</span>
                      </div>
                      {editId !== p.id && (
                        <div className="flex gap-1.5 shrink-0 ml-2">
                          <button onClick={() => startEditPractice(p)} className="text-xs text-stone-600 border border-stone-200 px-2 py-1 rounded-lg">編集</button>
                          <button onClick={() => setDeleteConfirm({ id: p.id, date: fmtDate(p.date) })} className="text-gray-300 text-lg active:text-red-400">✕</button>
                        </div>
                      )}
                    </div>
                    {editId === p.id ? (
                      <div className="mt-2 grid gap-2">
                        <div className="grid grid-cols-2 gap-2">
                          {["通常練習", "自主練習"].map((t) => (
                            <button key={t} type="button" onClick={() => setEditForm((f) => ({ ...f, type: t }))}
                              className={`py-2 rounded-lg text-sm font-medium border ${editForm.type === t ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"}`}>{t}</button>
                          ))}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">日付</label>
                          <input type="date" value={editForm.date} onChange={(e) => setEditForm((f) => ({ ...f, date: e.target.value }))} className="input" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">練習場名</label>
                          <input type="text" value={editForm.venue} onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))} placeholder="例: かりがね小学校" className="input" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-0.5">住所</label>
                          <input type="text" value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} placeholder="例: 愛知県刈谷市築地町2-15-1" className="input" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">開始</label>
                            <input type="time" value={editForm.startTime} onChange={(e) => setEditForm((f) => ({ ...f, startTime: e.target.value }))} className="input" />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">終了</label>
                            <input type="time" value={editForm.endTime} onChange={(e) => setEditForm((f) => ({ ...f, endTime: e.target.value }))} className="input" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEditPractice(p.id)} disabled={savingEdit} className="flex-1 bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                            {savingEdit ? "保存中..." : "保存"}
                          </button>
                          <button onClick={() => setEditId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(p.venue || p.address || p.startTime) && (
                          <div className="text-sm text-gray-500 mt-1">
                            {p.venue && <span>📍 {p.venue}</span>}
                            {p.startTime && <span className="ml-2">🕐 {p.startTime}{p.endTime ? `〜${p.endTime}` : ""}</span>}
                            {p.address && <div className="text-xs text-gray-400 mt-0.5">{p.address}</div>}
                          </div>
                        )}
                        <BucketDutyCard
                          practice={p}
                          duty={duty}
                          bucketActive={active}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </>
          )}
          {past.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-400 mb-2 mt-4">過去の練習</p>
              {past.map((p) => {
                const duty = duties.find((d) => d.practiceId === p.id) ?? null;
                const active = isBucketActive(p, bucketStart, bucketEnd);
                return (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-3 opacity-70">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-600"}`}>{p.type}</span>
                        <span className="font-semibold text-gray-700">{fmtDate(p.date)}</span>
                      </div>
                      <button onClick={() => setDeleteConfirm({ id: p.id, date: fmtDate(p.date) })} className="text-gray-300 text-lg active:text-red-400 ml-2">✕</button>
                    </div>
                    {(p.venue || p.startTime) && (
                      <div className="text-sm text-gray-500 mt-1">
                        {p.venue && <span>📍 {p.venue}</span>}
                        {p.startTime && <span className="ml-2">🕐 {p.startTime}{p.endTime ? `〜${p.endTime}` : ""}</span>}
                      </div>
                    )}
                    <BucketDutyCard
                      practice={p}
                      duty={duty}
                      bucketActive={active}
                    />
                  </div>
                );
              })}
            </>
          )}
        </>
      )}

      {/* カレンダー表示 */}
      {view === "cal" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { const d = new Date(calYear, calMonth - 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-400 text-xl px-2">‹</button>
            <span className="font-semibold text-gray-800">{calYear}年{calMonth + 1}月</span>
            <button onClick={() => { const d = new Date(calYear, calMonth + 1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }} className="text-gray-400 text-xl px-2">›</button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
              <div key={d} className={`text-center text-xs py-1 font-medium ${i === 0 ? "text-red-400" : i === 6 ? "text-stone-500" : "text-gray-400"}`}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const dayPractices = practiceMap[dateStr] ?? [];
              const isToday = dateStr === today;
              const dow = new Date(dateStr + "T00:00:00").getDay();
              return (
                <div key={day} className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative ${isToday ? "bg-stone-100 font-bold text-stone-800" : dow === 0 ? "text-red-400" : dow === 6 ? "text-stone-500" : "text-gray-700"}`}>
                  {day}
                  {dayPractices.length > 0 && (
                    <div className="flex gap-0.5 mt-0.5">
                      {dayPractices.map((p, pi) => (
                        <span key={pi} className={`w-1.5 h-1.5 rounded-full ${p.type === "自主練習" ? "bg-emerald-500" : "bg-stone-500"}`} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-3 justify-center">
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-stone-500 inline-block" />通常練習</div>
            <div className="flex items-center gap-1 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />自主練習</div>
          </div>
          {/* 当月の練習一覧 */}
          <div className="mt-4 border-t border-gray-100 pt-3">
            {(() => {
              const monthStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}`;
              const monthPractices = sorted.filter((p) => p.date.startsWith(monthStr));
              if (monthPractices.length === 0) return <p className="text-xs text-gray-400 text-center py-2">この月の練習はありません</p>;
              return monthPractices.map((p) => {
                const duty = duties.find((d) => d.practiceId === p.id);
                const active = isBucketActive(p, bucketStart, bucketEnd);
                return (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-600"}`}>{p.type}</span>
                      <span className="text-sm text-gray-700">{fmtDate(p.date)}</span>
                    </div>
                    {active && duty && (
                      <div className="text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        🪣 {duty.bringPersonName || "−"} / {duty.returnPersonName || "−"}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}
    </main>
  );
}
