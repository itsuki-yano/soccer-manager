"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import { VIEW_ONLY, VIEW_ONLY_PATHS } from "@/lib/viewOnly";

const menu = [
  { href: "/matches",        label: "試合・合宿管理", icon: "⚽", desc: "試合登録・配車当番の設定" },
  { href: "/practices",      label: "通常練習",       icon: "🏃", desc: "練習管理・バケツ当番" },
  { href: "/duty-roster",   label: "当番一覧",       icon: "📅", desc: "配車・荷物・バケツ当番の順番確認" },
  { href: "/roles",          label: "役割予定",       icon: "📋", desc: "選手別の担当予定を確認" },
  { href: "/league",         label: "リーグ戦戦績",   icon: "🏆", desc: "西三河リーグの順位・戦績" },
  { href: "/coach-expenses", label: "コーチ飲食費",   icon: "🧃", desc: "飲み物代・食事代の管理" },
  { href: "/parents",        label: "選手マスタ",     icon: "👟", desc: "選手・班・背番号の登録" },
  { href: "/export",         label: "まとめ役・会計担当", icon: "📊", desc: "まとめ役・会計担当用のExcelを出力" },
  { href: "/equipment",      label: "備品管理",       icon: "🎒", desc: "備品・救急セットの在庫管理" },
  { href: "/fees",           label: "費用徴収管理",   icon: "💰", desc: "合宿費・クラブ費の徴収状況" },
  { href: "/memo",           label: "備忘録",         icon: "📝", desc: "連絡事項・メモの記録" },
  { href: "/settings",       label: "設定",           icon: "⚙️", desc: "チーム名・会計担当者" },
];

type Link_ = { id: string; name: string; url: string; order?: number };

export default function Home() {
  const [links, setLinks] = useState<Link_[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ name: "", url: "" });
  const [savingLink, setSavingLink] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState("");
  const [teamName, setTeamName] = useState("トラヴェッソ 5年生");

  useEffect(() => {
    fetch("/api/links").then((r) => r.json()).then((d) => setLinks(Array.isArray(d) ? d : []));
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      if (d.logoUrl) setLogoUrl(d.logoUrl);
      if (d.teamName) setTeamName(d.teamName);
    });
  }, []);

  async function addLink() {
    if (!linkForm.name.trim() || !linkForm.url.trim()) return;
    setSavingLink(true);
    const res = await fetch("/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(linkForm),
    });
    const { id } = await res.json();
    setLinks((prev) => [...prev, { id, ...linkForm }]);
    setLinkForm({ name: "", url: "" });
    setShowLinkForm(false);
    setSavingLink(false);
  }

  function startEditLink(l: Link_) {
    setEditLinkId(l.id);
    setLinkForm({ name: l.name, url: l.url });
    setShowLinkForm(false);
  }

  async function saveEditLink(id: string) {
    setSavingLink(true);
    await fetch(`/api/links/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(linkForm),
    });
    setLinks((prev) => prev.map((l) => l.id === id ? { id, ...linkForm } : l));
    setEditLinkId(null);
    setLinkForm({ name: "", url: "" });
    setSavingLink(false);
  }

  async function deleteLink(id: string) {
    await fetch(`/api/links/${id}`, { method: "DELETE" });
    setLinks((prev) => prev.filter((l) => l.id !== id));
    setDeleteConfirm(null);
  }

  // 並び替え（上下移動）。即座にUI反映し、順序をサーバへ保存
  async function moveLink(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= links.length) return;
    const next = [...links];
    [next[index], next[target]] = [next[target], next[index]];
    setLinks(next);
    await fetch("/api/links", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((l) => l.id) }),
    });
  }

  return (
    <main className="max-w-lg md:max-w-3xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      {deleteConfirm && (
        <DeleteConfirmModal
          message={`「${deleteConfirm.name}」を削除しますか？`}
          onConfirm={() => deleteLink(deleteConfirm.id)}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
      <div className="text-center mb-8 md:hidden">
        <div className="w-20 h-20 mx-auto mb-2 rounded-2xl overflow-hidden flex items-center justify-center bg-gray-50">
          {logoUrl ? (
            <Image src={logoUrl} alt="チームロゴ" width={80} height={80} className="w-full h-full object-contain" />
          ) : (
            <span className="text-4xl">⚽</span>
          )}
        </div>
        <h1 className="text-2xl font-bold text-gray-800">マネジメントApp</h1>
        <p className="text-gray-500 text-sm mt-1">{teamName}</p>
      </div>
      <div className="hidden md:block mb-8">
        <h1 className="text-3xl font-bold text-gray-800">ダッシュボード</h1>
        <p className="text-gray-500 text-sm mt-1">{teamName} マネジメントApp</p>
      </div>

      {VIEW_ONLY && (
        <div className="mb-4 text-center text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-2">
          👀 閲覧専用モード
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3 mb-6">
        {(VIEW_ONLY ? menu.filter((m) => VIEW_ONLY_PATHS.includes(m.href)) : menu).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-4 hover:bg-stone-50 hover:border-stone-200 active:bg-gray-50 transition-colors"
          >
            <span className="text-3xl">{item.icon}</span>
            <div>
              <div className="font-semibold text-gray-800">{item.label}</div>
              <div className="text-sm text-gray-500">{item.desc}</div>
            </div>
            <span className="ml-auto text-gray-400 text-xl">›</span>
          </Link>
        ))}
      </div>

      {/* BANDトーク */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">💬</span>
            <span className="font-semibold text-gray-800">BANDトーク</span>
          </div>
          {!VIEW_ONLY && (
            <button
              onClick={() => { setShowLinkForm((v) => !v); setEditLinkId(null); setLinkForm({ name: "", url: "" }); }}
              className="text-xs text-stone-700 border border-stone-200 px-3 py-1.5 rounded-lg"
            >
              {showLinkForm ? "キャンセル" : "＋ 追加"}
            </button>
          )}
        </div>

        {showLinkForm && (
          <div className="mb-3 grid gap-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              value={linkForm.name}
              onChange={(e) => setLinkForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="名称（例: 5年生BANDトーク）"
              className="input text-sm"
            />
            <input
              type="url"
              value={linkForm.url}
              onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="URL（例: https://band.us/...）"
              className="input text-sm"
            />
            <button
              onClick={addLink}
              disabled={savingLink || !linkForm.name.trim() || !linkForm.url.trim()}
              className="w-full bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {savingLink ? "保存中..." : "保存"}
            </button>
          </div>
        )}

        {links.length === 0 && !showLinkForm && (
          <p className="text-sm text-gray-400 text-center py-2">リンクが登録されていません</p>
        )}

        <div className="grid gap-2">
          {links.map((l, i) => (
            <div key={l.id}>
              {editLinkId === l.id ? (
                <div className="grid gap-2 p-3 bg-gray-50 rounded-lg">
                  <input type="text" value={linkForm.name} onChange={(e) => setLinkForm((f) => ({ ...f, name: e.target.value }))} className="input text-sm" />
                  <input type="url" value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} className="input text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEditLink(l.id)} disabled={savingLink}
                      className="flex-1 bg-stone-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                      {savingLink ? "保存中..." : "保存"}
                    </button>
                    <button onClick={() => setEditLinkId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {!VIEW_ONLY && (
                    <div className="flex flex-col">
                      <button onClick={() => moveLink(i, -1)} disabled={i === 0}
                        className="text-gray-400 leading-none px-1 disabled:opacity-20 active:text-gray-600" aria-label="上へ">▲</button>
                      <button onClick={() => moveLink(i, 1)} disabled={i === links.length - 1}
                        className="text-gray-400 leading-none px-1 disabled:opacity-20 active:text-gray-600" aria-label="下へ">▼</button>
                    </div>
                  )}
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 active:bg-emerald-100"
                  >
                    <span className="text-lg">💬</span>
                    <span className="text-sm font-medium text-emerald-800">{l.name}</span>
                    <span className="ml-auto text-emerald-700 text-xs">開く ›</span>
                  </a>
                  {!VIEW_ONLY && (
                    <>
                      <button onClick={() => startEditLink(l)} className="text-xs text-gray-400 border border-gray-200 px-2 py-2 rounded-lg">
                        編集
                      </button>
                      <button onClick={() => setDeleteConfirm({ id: l.id, name: l.name })} className="text-xs text-red-400 border border-red-100 px-2 py-2 rounded-lg">
                        削除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
