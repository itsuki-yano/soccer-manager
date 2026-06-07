"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BackHeader from "@/components/BackHeader";

const CATEGORIES = ["合宿費用", "クラブ費", "イベント費用", "その他"];

export default function NewFeePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState("クラブ費");
  const [form, setForm] = useState({ name: "", amount: "", date: "", description: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save() {
    if (!form.name.trim() || !form.amount) { alert("名前と金額は必須です"); return; }
    setSaving(true);
    const res = await fetch("/api/fees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, category, amount: Number(form.amount) }),
    });
    if (res.ok) {
      router.push("/fees");
    } else {
      alert("保存に失敗しました");
      setSaving(false);
    }
  }

  return (
    <main className="max-w-lg md:max-w-4xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="費用を登録" back="/fees" />
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 grid gap-4">

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">カテゴリ</label>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)}
                className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  category === c ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-600 border-gray-200"
                }`}>{c}</button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">費用名 *</label>
          <input type="text" value={form.name} onChange={set("name")}
            placeholder="例: 5月合宿費用" className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">金額（1人あたり）*</label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">¥</span>
            <input type="number" value={form.amount} onChange={set("amount")}
              placeholder="例: 5000" className="input flex-1" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">日付</label>
          <input type="date" value={form.date} onChange={set("date")} className="input" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">メモ</label>
          <textarea value={form.description} onChange={set("description")}
            placeholder="例: 振込先: ○○銀行 ○○支店 普通 1234567"
            rows={3} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>

        <button onClick={save} disabled={saving}
          className="w-full bg-blue-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
          {saving ? "保存中..." : "登録する"}
        </button>
      </div>
    </main>
  );
}
