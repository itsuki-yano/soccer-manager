"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver, Parent, Practice, BucketDuty, Settings } from "@/lib/types";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${d.replace(/-/g, "/")}（${DOW[dt.getDay()]}）`;
}

function isBucketActive(p: Practice, start: string, end: string): boolean {
  if (p.type !== "自主練習") return false;
  if (new Date(p.date + "T00:00:00").getDay() !== 6) return false;
  if (!start || !end) return true;
  return p.date >= start && p.date <= end;
}

// チェックボックスグリッドで複数選択
function MultiSelect({
  names,
  selected,
  onChange,
}: {
  names: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 mt-1">
      {names.map((n) => {
        const on = selected.includes(n);
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(on ? selected.filter((x) => x !== n) : [...selected, n])}
            className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors ${on ? "bg-blue-500 text-white border-blue-500" : "bg-gray-50 text-gray-600 border-gray-200"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export default function DutyRosterPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [duties, setDuties] = useState<BucketDuty[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"driver" | "bucket">("driver");

  // 配車・荷物当番編集（フル）
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [editDriverNames, setEditDriverNames] = useState<string[]>([]);
  const [editEquipOut, setEditEquipOut] = useState<string[]>([]);
  const [editSkipped, setEditSkipped] = useState<string[]>([]);
  const [inheritDriver, setInheritDriver] = useState<{ date: string; names: string[] } | null>(null);
  const [inheritEquip, setInheritEquip] = useState<{ date: string; names: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  // スキップ簡易設定
  const [skipOnlyMatchId, setSkipOnlyMatchId] = useState<string | null>(null);
  const [skipOnlyNames, setSkipOnlyNames] = useState<string[]>([]);
  const [savingSkip, setSavingSkip] = useState(false);

  // 未来スロットの試合紐づけ（null = 自動割当）
  const [slotMatchIds, setSlotMatchIds] = useState<(string | null)[]>([null, null, null, null]);
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  // バケツ当番編集
  const [editBucketId, setEditBucketId] = useState<string | null>(null);
  const [editBring, setEditBring] = useState("");
  const [editRet, setEditRet] = useState("");
  const [savingBucket, setSavingBucket] = useState(false);

  const load = useCallback(async () => {
    const [ms, drvs, prts, ps, bds, st] = await Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
      fetch("/api/practices").then((r) => r.json()),
      fetch("/api/bucket-duties").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]);
    setMatches(Array.isArray(ms) ? ms : []);
    setDrivers(Array.isArray(drvs) ? drvs : []);
    setParents(Array.isArray(prts) ? prts : []);
    setPractices(Array.isArray(ps) ? ps : []);
    setDuties(Array.isArray(bds) ? bds : []);
    setSettings(st);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 班の表記を正規化（"1" → "1班"、"1班" → "1班"）
  function normalizeGroup(g: string) {
    if (!g) return "";
    return g.endsWith("班") ? g : `${g}班`;
  }

  function startEditMatch(m: Match, expectedGroup?: string) {
    setEditMatchId(m.id);
    setInheritDriver(null);
    setInheritEquip(null);

    const currentDrivers = drivers.filter((d) => d.matchId === m.id).map((d) => d.parentName);
    setEditSkipped(m.skippedDrivers ? m.skippedDrivers.split(",").map((s) => s.trim()).filter(Boolean) : []);

    const currentEquip = m.equipmentBringOut ? m.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];
    setEditEquipOut(currentEquip);

    if (currentDrivers.length === 0 && expectedGroup) {
      // 班のメンバーを配車当番に自動セット
      const normG = normalizeGroup(expectedGroup);
      const groupMembers = parents
        .filter((p) => normalizeGroup(p.group) === normG)
        .sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName))
        .map((p) => p.playerName);
      setEditDriverNames(groupMembers);
    } else {
      setEditDriverNames(currentDrivers);
    }

    // 直前の試合を取得（スキップ有無問わず）
    const prev = matches
      .filter((x) => x.id !== m.id && x.date < m.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (prev) {
      const skippedSet = new Set(
        prev.skippedDrivers ? prev.skippedDrivers.split(",").map((s) => s.trim()).filter(Boolean) : []
      );
      // 備品持帰り: 未設定なら前回の配車当番（スキップ除外）を候補に
      if (currentEquip.length === 0) {
        const prevDriverNames = drivers.filter((d) => d.matchId === prev.id).map((d) => d.parentName).filter((n) => !skippedSet.has(n));
        if (prevDriverNames.length > 0) setInheritEquip({ date: prev.date, names: prevDriverNames });
      }
    }
  }

  async function saveSkipOnly(m: Match) {
    setSavingSkip(true);
    await fetch(`/api/matches/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, skippedDrivers: skipOnlyNames.join(", ") }),
    });
    setMatches((prev) =>
      prev.map((x) => x.id === m.id ? { ...x, skippedDrivers: skipOnlyNames.join(", ") } : x)
    );
    setSkipOnlyMatchId(null);
    setSavingSkip(false);
  }

  async function saveMatchDuty(m: Match) {
    setSaving(true);
    await Promise.all([
      fetch("/api/drivers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: m.id, parentNames: editDriverNames }),
      }),
      fetch(`/api/matches/${m.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...m,
          carCount: editDriverNames.length,
          equipmentBringOut: editEquipOut.join(", "),
          skippedDrivers: editSkipped.join(", "),
        }),
      }),
    ]);
    setDrivers((prev) => [
      ...prev.filter((d) => d.matchId !== m.id),
      ...editDriverNames.map((name) => ({ matchId: m.id, parentName: name })),
    ]);
    setMatches((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? { ...x, carCount: editDriverNames.length, equipmentBringOut: editEquipOut.join(", "), skippedDrivers: editSkipped.join(", ") }
          : x
      )
    );
    setEditMatchId(null);
    setSaving(false);
  }

  function startEditBucket(p: Practice) {
    const duty = duties.find((d) => d.practiceId === p.id);
    setEditBucketId(p.id);
    setEditBring(duty?.bringPersonName ?? "");
    setEditRet(duty?.returnPersonName ?? "");
  }

  async function saveBucketDuty(practiceId: string) {
    setSavingBucket(true);
    const res = await fetch("/api/bucket-duties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ practiceId, bringPersonName: editBring, returnPersonName: editRet }),
    });
    const data = await res.json();
    setDuties((prev) => [
      ...prev.filter((d) => d.practiceId !== practiceId),
      { id: data.id ?? "", practiceId, bringPersonName: editBring, returnPersonName: editRet },
    ]);
    setEditBucketId(null);
    setSavingBucket(false);
  }

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const today = new Date().toISOString().slice(0, 10);
  const parentNames = [...parents].sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName)).map((p) => p.playerName);

  // 試合: 未来昇順 → 過去降順
  const futureMatches = matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastMatches = matches.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const orderedMatches = [...futureMatches, ...pastMatches];

  // バケツ: 未来昇順 → 過去降順
  const bStart = settings?.bucketDutyStartDate ?? "";
  const bEnd = settings?.bucketDutyEndDate ?? "";
  const activePractices = practices.filter((p) => isBucketActive(p, bStart, bEnd));
  const futureBucket = activePractices.filter((p) => p.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastBucket = activePractices.filter((p) => p.date < today).sort((a, b) => b.date.localeCompare(a.date));
  const orderedBucket = [...futureBucket, ...pastBucket];

  // ────────── 配車・荷物当番パネル ──────────
  const DriverPanel = () => {
    // 班ローテーション計算
    const sortedGroups = [...new Set(parents.map((p) => p.group).filter(Boolean))].sort();

    function normN(s: string) { return s.replace(/[\s　]/g, ""); }

    function getMatchGroup(matchId: string): string {
      const mDrivers = drivers.filter((d) => d.matchId === matchId);
      if (mDrivers.length === 0) return "";
      const cnt: Record<string, number> = {};
      mDrivers.forEach((d) => {
        const p = parents.find((px) => normN(px.playerName) === normN(d.parentName));
        if (p?.group) cnt[p.group] = (cnt[p.group] || 0) + 1;
      });
      return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    }

    // 過去の試合（全件、新→旧）
    const pastMatches = matches.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));

    // 最後に当番した班を特定
    const lastGroupMatch = pastMatches.find((m) => drivers.some((d) => d.matchId === m.id));
    const lastGroup = lastGroupMatch ? getMatchGroup(lastGroupMatch.id) : "";

    // 未来4回の班ローテーション
    const futureGroups: string[] = [];
    if (sortedGroups.length > 0) {
      let g = lastGroup;
      for (let i = 0; i < 4; i++) {
        const idx = g ? sortedGroups.indexOf(g) : -1;
        g = sortedGroups[(idx + 1) % sortedGroups.length];
        futureGroups.push(g);
      }
    } else {
      futureGroups.push(...["", "", "", ""]);
    }

    // 未来の試合（日付昇順）
    const futureMatchesSorted = matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    // スロットの有効な試合ID（明示的に選んだ場合のみ紐づけ、自動割当なし）
    const effectiveSlotMatchIds = slotMatchIds.map((override) =>
      override !== null && override !== "" ? override : null
    );

    // 各スロットの班メンバーを取得（配車当番の表示用）
    function getGroupMembers(g: string): string[] {
      const normGVal = normG(g);
      return parents
        .filter((p) => normG(p.group) === normGVal)
        .sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName))
        .map((p) => p.playerName);
    }

    // 班バッジ色（"1" or "1班" どちらでも対応）
    function normG(g: string) { return g.endsWith("班") ? g : `${g}班`; }
    const GROUP_COLORS: Record<string, { bg: string; text: string }> = {
      "1班": { bg: "bg-blue-100", text: "text-blue-700" },
      "2班": { bg: "bg-green-100", text: "text-green-700" },
      "3班": { bg: "bg-orange-100", text: "text-orange-700" },
      "4班": { bg: "bg-purple-100", text: "text-purple-700" },
    };
    function groupBadge(g: string) {
      const label = normG(g);
      const c = GROUP_COLORS[label] ?? { bg: "bg-gray-100", text: "text-gray-600" };
      return `text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${c.bg} ${c.text}`;
    }
    function groupDisplay(g: string) { return normG(g); }

    // 編集フォームの共通部分
    function EditForm({ m, groupLabel }: { m: Match; groupLabel?: string }) {
      return (
        <div className="space-y-3">
          {inheritDriver && editDriverNames.length === 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs text-blue-700 min-w-0">
                <span className="font-semibold">前回({fmtDate(inheritDriver.date)})の備品持帰り</span>を引継ぎますか？
                <div className="flex flex-wrap gap-1 mt-1">
                  {inheritDriver.names.map((n) => <span key={n} className="bg-blue-100 px-1.5 py-0.5 rounded-full">{n}</span>)}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditDriverNames(inheritDriver.names); setInheritDriver(null); }} className="text-xs bg-blue-500 text-white px-2 py-1 rounded-lg">引継ぐ</button>
                <button onClick={() => setInheritDriver(null)} className="text-xs text-gray-400 px-1">✕</button>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">🚗 配車当番{groupLabel ? `（${groupLabel}）` : ""}</p>
            <MultiSelect names={parentNames} selected={editDriverNames} onChange={setEditDriverNames} />
          </div>
          {inheritEquip && editEquipOut.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs text-orange-700 min-w-0">
                <span className="font-semibold">前回({fmtDate(inheritEquip.date)})の配車当番</span>を引継ぎますか？
                <div className="flex flex-wrap gap-1 mt-1">
                  {inheritEquip.names.map((n) => <span key={n} className="bg-orange-100 px-1.5 py-0.5 rounded-full">{n}</span>)}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditEquipOut(inheritEquip.names); setInheritEquip(null); }} className="text-xs bg-orange-500 text-white px-2 py-1 rounded-lg">引継ぐ</button>
                <button onClick={() => setInheritEquip(null)} className="text-xs text-gray-400 px-1">✕</button>
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">🎒 備品持帰り</p>
            <MultiSelect names={parentNames} selected={editEquipOut} onChange={setEditEquipOut} />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-1">スキップ（今回免除）</p>
            <MultiSelect names={parentNames} selected={editSkipped} onChange={setEditSkipped} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMatchDuty(m)} disabled={saving} className="flex-1 bg-blue-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setEditMatchId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
          </div>
        </div>
      );
    }

    function SkipForm({ m, names }: { m: Match; names: string[] }) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500">スキップ設定（今回のみ免除）</p>
          <MultiSelect names={names.length > 0 ? names : parentNames} selected={skipOnlyNames} onChange={setSkipOnlyNames} />
          <div className="flex gap-2">
            <button onClick={() => saveSkipOnly(m)} disabled={savingSkip} className="flex-1 bg-gray-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
              {savingSkip ? "保存中..." : "スキップ保存"}
            </button>
            <button onClick={() => setSkipOnlyMatchId(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">キャンセル</button>
          </div>
        </div>
      );
    }

    return (
      <div>
        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span>🚗</span> 配車・荷物当番
        </h2>

        {/* ── 今後の当番（次4回） ── */}
        <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">今後の当番（次4回）</p>
        <div className="grid gap-2 mb-5">
          {futureGroups.map((group, i) => {
            const linkedMatchId = effectiveSlotMatchIds[i];
            const linkedMatch = linkedMatchId ? matches.find((m) => m.id === linkedMatchId) : null;
            const groupMembers = getGroupMembers(group);
            // 配車当番: 紐づけ試合のドライバー設定済みならそちら、なければ班メンバー
            const slotDrivers = linkedMatchId
              ? drivers.filter((d) => d.matchId === linkedMatchId).map((d) => d.parentName)
              : groupMembers;
            // 備品持帰り: 紐づけ試合に設定済みならそちら、なければ前の班のメンバー
            const prevGroup = i === 0 ? lastGroup : futureGroups[i - 1];
            const slotEquipOut = linkedMatch?.equipmentBringOut
              ? linkedMatch.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean)
              : getGroupMembers(prevGroup);
            const isEditing = Boolean(linkedMatchId && editMatchId === linkedMatchId);
            const isPicking = pickingSlot === i;
            const slotLabel = i === 0 ? "次回" : `${i + 1}回後`;

            return (
              <div key={i} className={`bg-white rounded-xl border p-3 ${i === 0 ? "border-blue-300 shadow-md" : "border-gray-100 shadow-sm"}`}>
                {/* ヘッダー */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${i === 0 ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"}`}>{slotLabel}</span>
                    {group && <span className={groupBadge(group)}>{groupDisplay(group)}</span>}
                    {linkedMatch && (
                      <span className="text-xs text-gray-500 truncate">{fmtDate(linkedMatch.date)}　{linkedMatch.matchName || linkedMatch.matchType}</span>
                    )}
                  </div>
                  {!isEditing && !isPicking && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => setPickingSlot(i)}
                        className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg"
                      >
                        {linkedMatch ? "試合変更" : "試合選択"}
                      </button>
                      {linkedMatch && (
                        <button
                          onClick={() => { setSkipOnlyMatchId(null); startEditMatch(linkedMatch, group); }}
                          className="text-xs text-blue-500 border border-blue-200 px-2 py-1 rounded-lg"
                        >変更</button>
                      )}
                    </div>
                  )}
                </div>

                {/* 試合選択ピッカー */}
                {isPicking && (
                  <div className="space-y-1.5 mb-2">
                    <p className="text-xs text-gray-500 font-semibold">紐づける試合を選択</p>
                    <div className="grid gap-1 max-h-44 overflow-y-auto">
                      {linkedMatch && (
                        <button
                          onClick={() => { const ids = [...slotMatchIds]; ids[i] = ""; setSlotMatchIds(ids); setPickingSlot(null); setEditMatchId(null); }}
                          className="text-xs text-left px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400"
                        >
                          紐づけ解除
                        </button>
                      )}
                      {futureMatchesSorted.map((fm) => (
                        <button
                          key={fm.id}
                          onClick={() => {
                            const ids = [...slotMatchIds];
                            ids[i] = fm.id;
                            setSlotMatchIds(ids);
                            setPickingSlot(null);
                            startEditMatch(fm, group);
                          }}
                          className={`text-xs text-left px-2 py-1.5 rounded-lg border ${linkedMatchId === fm.id ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        >
                          {fmtDate(fm.date)}　{fm.matchName || fm.matchType}{fm.venue ? ` @ ${fm.venue}` : ""}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setPickingSlot(null)} className="text-xs text-gray-400">キャンセル</button>
                  </div>
                )}

                {/* 編集フォーム or 表示 */}
                {isEditing && linkedMatch ? (
                  <EditForm m={linkedMatch} groupLabel={group} />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2 bg-purple-50 border border-purple-100">
                      <p className="text-xs text-gray-400 mb-1">🚗 配車当番</p>
                      <div className="flex flex-wrap gap-1">
                        {slotDrivers.map((n) => <span key={n} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
                      </div>
                    </div>
                    <div className="rounded-lg p-2 bg-orange-50 border border-orange-100">
                      <p className="text-xs text-gray-400 mb-1">🎒 備品持帰り</p>
                      {slotEquipOut.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {slotEquipOut.map((n) => <span key={n} className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
                        </div>
                      ) : <span className="text-xs text-gray-400 text-sm">−</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── 過去の当番 ── */}
        {pastMatches.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">過去の当番</p>
            <div className="grid gap-2">
              {pastMatches.map((m) => {
                const matchDrivers = drivers.filter((d) => d.matchId === m.id).map((d) => d.parentName);
                const equipOut = m.equipmentBringOut ? m.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];
                const skipped = m.skippedDrivers ? m.skippedDrivers.split(",").map((s) => s.trim()).filter(Boolean) : [];
                const group = getMatchGroup(m.id);
                const isEditing = editMatchId === m.id;
                const isSkipping = skipOnlyMatchId === m.id;

                return (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-3 opacity-70">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">過去</span>
                        {group && <span className={groupBadge(group)}>{groupDisplay(group)}</span>}
                        <span className="text-sm font-semibold text-gray-500">{fmtDate(m.date)}</span>
                        <span className="text-xs text-gray-400 truncate">{m.matchName || m.matchType}{m.venue ? ` @ ${m.venue}` : ""}</span>
                      </div>
                      {!isEditing && !isSkipping && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => { setSkipOnlyMatchId(m.id); setSkipOnlyNames(skipped); setEditMatchId(null); }} className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded-lg">スキップ</button>
                          <button onClick={() => { setSkipOnlyMatchId(null); startEditMatch(m); }} className="text-xs text-blue-500 border border-blue-200 px-2 py-1 rounded-lg">変更</button>
                          <Link href={`/matches/${m.id}`} className="text-xs text-gray-400 border border-gray-200 px-2 py-1 rounded-lg">詳細 ›</Link>
                        </div>
                      )}
                    </div>

                    {isEditing ? (
                      <EditForm m={m} groupLabel={group} />
                    ) : isSkipping ? (
                      <SkipForm m={m} names={matchDrivers} />
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2 bg-gray-50">
                          <p className="text-xs text-gray-400 mb-1">🚗 配車当番</p>
                          {matchDrivers.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {matchDrivers.map((n) => <span key={n} className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
                            </div>
                          ) : <span className="text-xs text-gray-300">未設定</span>}
                          {skipped.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {skipped.map((n) => <span key={n} className="text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full line-through">{n}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="rounded-lg p-2 bg-gray-50">
                          <p className="text-xs text-gray-400 mb-1">🎒 備品持帰り</p>
                          {equipOut.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {equipOut.map((n) => <span key={n} className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
                            </div>
                          ) : <span className="text-xs text-gray-300">未設定</span>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ────────── バケツ当番パネル ──────────
  const BucketPanel = () => (
    <div>
      <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
        <span>🪣</span> バケツ当番
      </h2>
      {orderedBucket.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-8">
          {!bStart || !bEnd ? "設定画面でバケツ当番の期間を設定してください" : "対象の練習がありません"}
        </p>
      )}
      <div className="grid gap-2">
        {orderedBucket.map((p, i) => {
          const isPast = p.date < today;
          const isNext = !isPast && i === 0;
          const duty = duties.find((d) => d.practiceId === p.id);
          const isEditing = editBucketId === p.id;

          return (
            <div
              key={p.id}
              className={`bg-white rounded-xl border p-3 transition-all ${isPast ? "opacity-60 border-gray-100" : isNext ? "border-yellow-300 shadow-md" : "border-gray-100 shadow-sm"}`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {isNext && <span className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full font-bold shrink-0">次回</span>}
                  {isPast && <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">過去</span>}
                  <span className={`text-sm font-semibold ${isPast ? "text-gray-500" : "text-gray-800"}`}>{fmtDate(p.date)}</span>
                  <span className="text-xs text-gray-400">自主練習</span>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => startEditBucket(p)}
                    className="text-xs text-yellow-600 border border-yellow-200 px-2 py-1 rounded-lg shrink-0"
                  >
                    {duty ? "変更" : "設定"}
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">持っていく</label>
                      <select
                        value={editBring}
                        onChange={(e) => setEditBring(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">未設定</option>
                        {parentNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-0.5 block">持って帰る</label>
                      <select
                        value={editRet}
                        onChange={(e) => setEditRet(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white"
                      >
                        <option value="">未設定</option>
                        {parentNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveBucketDuty(p.id)}
                      disabled={savingBucket}
                      className="flex-1 bg-yellow-500 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                    >
                      {savingBucket ? "保存中..." : "保存"}
                    </button>
                    <button
                      onClick={() => setEditBucketId(null)}
                      className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className={`rounded-lg p-2 ${isPast ? "bg-gray-50" : "bg-blue-50 border border-blue-100"}`}>
                    <p className="text-xs text-gray-400 mb-0.5">持っていく</p>
                    <p className={`text-sm font-semibold ${isPast ? "text-gray-400" : "text-blue-800"}`}>{duty?.bringPersonName || "−"}</p>
                  </div>
                  <div className={`rounded-lg p-2 ${isPast ? "bg-gray-50" : "bg-pink-50 border border-pink-100"}`}>
                    <p className="text-xs text-gray-400 mb-0.5">持って帰る</p>
                    <p className={`text-sm font-semibold ${isPast ? "text-gray-400" : "text-pink-800"}`}>{duty?.returnPersonName || "−"}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="当番一覧" />

      {/* スマホ: タブ切替 */}
      <div className="flex bg-gray-100 rounded-xl overflow-hidden border border-gray-200 mb-4 md:hidden">
        {(["driver", "bucket"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mobileTab === tab ? "bg-white text-gray-800 shadow-sm" : "text-gray-500"}`}
          >
            {tab === "driver" ? "🚗 配車・荷物" : "🪣 バケツ"}
          </button>
        ))}
      </div>

      {/* PC: 2カラム / スマホ: タブ内容 */}
      <div className="hidden md:grid md:grid-cols-2 md:gap-6">
        <DriverPanel />
        <BucketPanel />
      </div>
      <div className="md:hidden">
        {mobileTab === "driver" ? <DriverPanel /> : <BucketPanel />}
      </div>
    </main>
  );
}
