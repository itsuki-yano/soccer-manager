"use client";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BackHeader from "@/components/BackHeader";
import type { Match, Driver, Parent, Practice, BucketDuty, Settings, DutySwap } from "@/lib/types";

const DOW = ["日", "月", "火", "水", "木", "金", "土"];

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return `${d.replace(/-/g, "/")}（${DOW[dt.getDay()]}）`;
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
            className={`text-xs px-2 py-1.5 rounded-lg border text-left transition-colors ${on ? "bg-stone-700 text-white border-stone-700" : "bg-gray-50 text-gray-600 border-gray-200"}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

function DutyRosterInner() {
  const searchParams = useSearchParams();
  const [matches, setMatches] = useState<Match[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [practices, setPractices] = useState<Practice[]>([]);
  const [duties, setDuties] = useState<BucketDuty[]>([]);
  const [swaps, setSwaps] = useState<DutySwap[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileTab, setMobileTab] = useState<"driver" | "bucket">("driver");

  // 配車・荷物当番編集
  const [editMatchId, setEditMatchId] = useState<string | null>(null);
  const [editDriverNames, setEditDriverNames] = useState<string[]>([]);
  const [editEquipOut, setEditEquipOut] = useState<string[]>([]);
  const [inheritDriver, setInheritDriver] = useState<{ date: string; names: string[] } | null>(null);
  const [inheritEquip, setInheritEquip] = useState<{ date: string; names: string[] } | null>(null);
  const [saving, setSaving] = useState(false);

  // スキップ簡易設定（過去試合用）
  const [skipOnlyMatchId, setSkipOnlyMatchId] = useState<string | null>(null);
  const [skipOnlyNames, setSkipOnlyNames] = useState<string[]>([]);
  const [savingSkip, setSavingSkip] = useState(false);

  // 未来スロットの試合紐づけ（localStorageで永続化）
  const [slotMatchIds, setSlotMatchIds] = useState<(string | null)[]>(() => {
    try {
      const saved = localStorage.getItem("dutyRosterSlotMatchIds");
      return saved ? JSON.parse(saved) : [null, null, null, null];
    } catch { return [null, null, null, null]; }
  });
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);
  // 編集しようとして未紐付けだったため試合選択を促している状態
  const [pickerNoticeSlot, setPickerNoticeSlot] = useState<number | null>(null);

  // 個人スワップ
  const [swapSlot, setSwapSlot] = useState<number | null>(null);
  const [swapFrom, setSwapFrom] = useState("");
  const [swapTo, setSwapTo] = useState("");
  const [savingSwap, setSavingSwap] = useState(false);

  // slotMatchIds を localStorage に保存
  useEffect(() => {
    try { localStorage.setItem("dutyRosterSlotMatchIds", JSON.stringify(slotMatchIds)); } catch {}
  }, [slotMatchIds]);

  // バケツ当番スロット（localStorageで永続化）
  const [slotBucketPracticeIds, setSlotBucketPracticeIds] = useState<(string | null)[]>(() => {
    try {
      const saved = localStorage.getItem("dutyRosterSlotBucketPracticeIds");
      return saved ? JSON.parse(saved) : [null, null, null, null];
    } catch { return [null, null, null, null]; }
  });
  // slotBucketPracticeIds を localStorage に保存
  useEffect(() => {
    try { localStorage.setItem("dutyRosterSlotBucketPracticeIds", JSON.stringify(slotBucketPracticeIds)); } catch {}
  }, [slotBucketPracticeIds]);

  const [pickingBucketSlot, setPickingBucketSlot] = useState<number | null>(null);
  const [editBucketSlot, setEditBucketSlot] = useState<number | null>(null);
  const [editBring, setEditBring] = useState("");
  const [editRet, setEditRet] = useState("");
  const [savingBucket, setSavingBucket] = useState(false);

  const load = useCallback(async () => {
    const [ms, drvs, prts, ps, bds, st, sw] = await Promise.all([
      fetch("/api/matches").then((r) => r.json()),
      fetch("/api/drivers").then((r) => r.json()),
      fetch("/api/parents").then((r) => r.json()),
      fetch("/api/practices").then((r) => r.json()),
      fetch("/api/bucket-duties").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/duty-swaps").then((r) => r.json()),
    ]);
    setMatches(Array.isArray(ms) ? ms : []);
    setDrivers(Array.isArray(drvs) ? drvs : []);
    setParents(Array.isArray(prts) ? prts : []);
    setPractices(Array.isArray(ps) ? ps : []);
    setDuties(Array.isArray(bds) ? bds : []);
    setSettings(st);
    setSwaps(Array.isArray(sw) ? sw : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // URL パラメータ ?matchId= / ?practiceId= があれば最初の空きスロットに自動リンク
  useEffect(() => {
    const matchId = searchParams.get("matchId");
    if (matchId) {
      setSlotMatchIds((prev) => {
        if (prev.includes(matchId)) return prev;
        const idx = prev.findIndex((v) => v === null);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = matchId;
        return next;
      });
    }
    const practiceId = searchParams.get("practiceId");
    if (practiceId) {
      setSlotBucketPracticeIds((prev) => {
        if (prev.includes(practiceId)) return prev;
        const idx = prev.findIndex((v) => v === null);
        if (idx < 0) return prev;
        const next = [...prev];
        next[idx] = practiceId;
        return next;
      });
      setMobileTab("bucket");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function normalizeGroup(g: string) {
    if (!g) return "";
    return g.endsWith("班") ? g : `${g}班`;
  }

  // スワップが対象とするセル数（=絡む試合数）。これを過ぎたら自動非表示
  function swapCoverage(s: DutySwap): number {
    return s.kind === "driver" ? 3 : 2;
  }

  // 有効期限内（自動非表示になっていない）のスワップ一覧
  function getActiveSwaps(): DutySwap[] {
    return swaps.filter((s) => {
      if (!s.fromDate) return true;
      const past = pastMatches.filter((m) => m.date >= s.fromDate).length;
      return past < swapCoverage(s);
    });
  }

  // 単一スワップを (スロット, フィールド種別) のセルに適用した結果の名前を返す
  // 配車スワップ(driver): i配車 A→B / 代役Bの班の次の当番 (j-1)備品 B→A・(j)配車 B→A
  // 備品スワップ(equip):  i備品 A→B / (i+1)配車 A→B（代役Bがその班の配車も担当）
  function applyOneSwapToCell(name: string, slotIndex: number, field: "driver" | "equip", s: DutySwap): string {
    const i = s.appliedFromSlotIndex;
    if (s.kind === "driver") {
      const j = s.returnSlotIndex;
      if (slotIndex === i && field === "driver" && name === s.personA) return s.personB;
      if (j > i && slotIndex === j - 1 && field === "equip" && name === s.personB) return s.personA;
      if (j > i && slotIndex === j && field === "driver" && name === s.personB) return s.personA;
    } else {
      if (slotIndex === i && field === "equip" && name === s.personA) return s.personB;
      if (slotIndex === i + 1 && field === "driver" && name === s.personA) return s.personB;
    }
    return name;
  }

  function applySwapToCell(name: string, slotIndex: number, field: "driver" | "equip", active: DutySwap[]): string {
    for (const s of active) {
      const next = applyOneSwapToCell(name, slotIndex, field, s);
      if (next !== name) return next;
    }
    return name;
  }

  function applySwaps(names: string[], slotIndex: number, field: "driver" | "equip"): string[] {
    const active = getActiveSwaps();
    return names.map((name) => applySwapToCell(name, slotIndex, field, active));
  }

  // expectedEquipGroup: 備品持帰り班（次の班）を自動セットするために使用
  function startEditMatch(m: Match, expectedGroup?: string, expectedEquipGroup?: string, slotIndex = 0) {
    setEditMatchId(m.id);
    setInheritDriver(null);
    setInheritEquip(null);

    const currentDrivers = drivers.filter((d) => d.matchId === m.id).map((d) => d.parentName);
    const currentEquip = m.equipmentBringOut ? m.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];

    if (currentDrivers.length === 0 && expectedGroup) {
      const normG = normalizeGroup(expectedGroup);
      const groupMembers = applySwaps(
        parents
          .filter((p) => normalizeGroup(p.group) === normG)
          .sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName))
          .map((p) => p.playerName),
        slotIndex,
        "driver"
      );
      setEditDriverNames(groupMembers);
    } else {
      setEditDriverNames(currentDrivers);
    }

    if (currentEquip.length === 0 && expectedEquipGroup) {
      // 備品持帰り: 次の班メンバーを自動セット
      const normEG = normalizeGroup(expectedEquipGroup);
      const equipMembers = applySwaps(
        parents
          .filter((p) => normalizeGroup(p.group) === normEG)
          .sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName))
          .map((p) => p.playerName),
        slotIndex,
        "equip"
      );
      setEditEquipOut(equipMembers);
    } else {
      setEditEquipOut(currentEquip);
    }

    // 備品持帰り未設定の場合: 前回の配車当番を引継ぎ候補に
    if (currentEquip.length === 0 && !expectedEquipGroup) {
      const prev = matches
        .filter((x) => x.id !== m.id && x.date < m.date)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (prev) {
        const skippedSet = new Set(
          prev.skippedDrivers ? prev.skippedDrivers.split(",").map((s) => s.trim()).filter(Boolean) : []
        );
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
          ? { ...x, carCount: editDriverNames.length, equipmentBringOut: editEquipOut.join(", ") }
          : x
      )
    );
    setEditMatchId(null);
    setSaving(false);
  }

  async function saveBucketSlot(slotIdx: number, practiceId: string | null) {
    setSavingBucket(true);
    const pid = practiceId ?? "";
    if (pid) {
      const res = await fetch("/api/bucket-duties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ practiceId: pid, bringPersonName: editBring, returnPersonName: editRet }),
      });
      const data = await res.json();
      setDuties((prev) => [
        ...prev.filter((d) => d.practiceId !== pid),
        { id: data.id ?? "", practiceId: pid, bringPersonName: editBring, returnPersonName: editRet },
      ]);
    }
    setEditBucketSlot(null);
    setSavingBucket(false);
  }

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-8 text-center text-gray-400">読み込み中...</div>;

  const today = new Date().toISOString().slice(0, 10);
  const parentNames = [...parents].sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName)).map((p) => p.playerName);

  const futureMatches = matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const pastMatches = matches.filter((m) => m.date < today).sort((a, b) => b.date.localeCompare(a.date));

  // ────────── 配車・荷物当番パネル ──────────
  const DriverPanel = () => {
    const sortedGroups = [...new Set(parents.map((p) => normalizeGroup(p.group)).filter(Boolean))].sort();

    function normN(s: string) { return s.replace(/[\s　]/g, ""); }

    function getMatchGroup(matchId: string): string {
      const mDrivers = drivers.filter((d) => d.matchId === matchId);
      if (mDrivers.length === 0) return "";
      const cnt: Record<string, number> = {};
      mDrivers.forEach((d) => {
        const p = parents.find((px) => normN(px.playerName) === normN(d.parentName));
        if (p?.group) {
          const ng = normalizeGroup(p.group);
          cnt[ng] = (cnt[ng] || 0) + 1;
        }
      });
      return Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    }

    const lastGroupMatch = pastMatches.find((m) => drivers.some((d) => d.matchId === m.id));
    const lastGroup = lastGroupMatch ? getMatchGroup(lastGroupMatch.id) : "";

    // 表示するスロット数: デフォルト4回。今後の試合数が4以上ならその数だけ表示
    const displayCount = Math.max(4, futureMatches.length);

    function nextInRotation(g: string): string {
      if (!sortedGroups.length) return "";
      const idx = g ? sortedGroups.indexOf(g) : -1;
      return sortedGroups[(idx + 1) % sortedGroups.length];
    }
    const futureGroups: string[] = [];
    if (sortedGroups.length > 0) {
      let g = lastGroup;
      // 備品持帰り用に +1 回分多く生成（futureGroups[i+1] を参照するため）
      for (let i = 0; i < displayCount + 1; i++) {
        g = nextInRotation(g);
        futureGroups.push(g);
      }
    } else {
      futureGroups.push(...Array(displayCount + 1).fill(""));
    }

    const futureMatchesSorted = matches.filter((m) => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    // slotMatchIds を displayCount 長に揃える（不足分は null）
    const paddedSlotMatchIds: (string | null)[] = Array.from(
      { length: displayCount },
      (_, i) => slotMatchIds[i] ?? null
    );
    const effectiveSlotMatchIds = paddedSlotMatchIds.map((override) => {
      if (!override || override === "") return null;
      const m = matches.find((x) => x.id === override);
      if (!m || m.date < today) return null;
      return override;
    });

    const activeSwaps = getActiveSwaps();

    function getGroupMembers(g: string, slotIndex: number, field: "driver" | "equip"): string[] {
      const normGVal = normalizeGroup(g);
      const base = parents
        .filter((p) => normalizeGroup(p.group) === normGVal)
        .sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName))
        .map((p) => p.playerName);
      // 種別・スロットに応じたスワップを適用
      return base.map((name) => applySwapToCell(name, slotIndex, field, activeSwaps));
    }

    async function saveSwap() {
      if (!swapFrom || !swapTo || swapSlot === null) return;
      setSavingSwap(true);
      const appliedFromSlotIndex = swapSlot;
      // fromDate: そのスロットに紐づく試合日、なければ今日
      const linkedMatchForSlot = effectiveSlotMatchIds[appliedFromSlotIndex]
        ? matches.find((m) => m.id === effectiveSlotMatchIds[appliedFromSlotIndex])
        : null;
      const fromDate = linkedMatchForSlot?.date ?? today;

      // 起点スロットで swapFrom が配車当番か備品持帰りかを判定して種別を決める
      const startDrivers = linkedMatchForSlot
        ? drivers.filter((d) => d.matchId === linkedMatchForSlot.id).map((d) => d.parentName)
        : getGroupMembers(futureGroups[appliedFromSlotIndex] ?? "", appliedFromSlotIndex, "driver");
      const kind: "driver" | "equip" = startDrivers.includes(swapFrom) ? "driver" : "equip";

      // 配車スワップ: 代役Bの班が次に配車を担当するスロット番号 j を求める
      let returnSlotIndex = 0;
      if (kind === "driver") {
        const bGroup = normalizeGroup(parents.find((p) => p.playerName === swapTo)?.group ?? "");
        for (let k = appliedFromSlotIndex + 1; k < futureGroups.length; k++) {
          if (normalizeGroup(futureGroups[k] ?? "") === bGroup) { returnSlotIndex = k; break; }
        }
      }

      const res = await fetch("/api/duty-swaps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personA: swapFrom, personB: swapTo, appliedFromSlotIndex, fromDate, kind, returnSlotIndex }),
      });
      const data = await res.json();
      const newSwap: DutySwap = { id: data.id, personA: swapFrom, personB: swapTo, appliedFromSlotIndex, fromDate, kind, returnSlotIndex };
      setSwaps((prev) => [...prev, newSwap]);

      // 起点〜代役の当番回までのスロットのDB済みデータに、このスワップを種別・フィールド別に反映
      const lastSlot = kind === "driver" ? Math.max(returnSlotIndex, appliedFromSlotIndex + 1) : appliedFromSlotIndex + 1;
      for (let si = appliedFromSlotIndex; si <= lastSlot; si++) {
        const lid = effectiveSlotMatchIds[si];
        if (!lid) continue;
        const lm = matches.find((m) => m.id === lid);
        if (!lm) continue;

        const curDrv = drivers.filter((d) => d.matchId === lid).map((d) => d.parentName);
        const newDrv = curDrv.map((n) => applyOneSwapToCell(n, si, "driver", newSwap));
        if (curDrv.join() !== newDrv.join()) {
          await fetch("/api/drivers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matchId: lid, parentNames: newDrv }),
          });
          setDrivers((prev) => [
            ...prev.filter((d) => d.matchId !== lid),
            ...newDrv.map((name) => ({ matchId: lid, parentName: name })),
          ]);
        }

        const curEq = lm.equipmentBringOut ? lm.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean) : [];
        const newEq = curEq.map((n) => applyOneSwapToCell(n, si, "equip", newSwap));
        if (curEq.join() !== newEq.join()) {
          await fetch(`/api/matches/${lid}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...lm, equipmentBringOut: newEq.join(", ") }),
          });
          setMatches((prev) => prev.map((m) => m.id === lid ? { ...m, equipmentBringOut: newEq.join(", ") } : m));
        }
      }

      setSwapSlot(null);
      setSwapFrom("");
      setSwapTo("");
      setSavingSwap(false);
    }

    const GROUP_COLORS: Record<string, { bg: string; text: string }> = {
      "1班": { bg: "bg-stone-100", text: "text-stone-700" },
      "2班": { bg: "bg-emerald-100", text: "text-emerald-800" },
      "3班": { bg: "bg-amber-100", text: "text-amber-800" },
      "4班": { bg: "bg-amber-100", text: "text-amber-800" },
    };
    function groupBadge(g: string) {
      const label = normalizeGroup(g);
      const c = GROUP_COLORS[label] ?? { bg: "bg-gray-100", text: "text-gray-600" };
      return `text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${c.bg} ${c.text}`;
    }
    function groupDisplay(g: string) { return normalizeGroup(g); }

    function EditForm({ m, groupLabel }: { m: Match; groupLabel?: string }) {
      return (
        <div className="space-y-3">
          {inheritDriver && editDriverNames.length === 0 && (
            <div className="bg-stone-100 border border-stone-300 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs text-stone-800 min-w-0">
                <span className="font-semibold">前回({fmtDate(inheritDriver.date)})の備品持帰り</span>を引継ぎますか？
                <div className="flex flex-wrap gap-1 mt-1">
                  {inheritDriver.names.map((n) => <span key={n} className="bg-stone-200 px-1.5 py-0.5 rounded-full">{n}</span>)}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditDriverNames(inheritDriver.names); setInheritDriver(null); }} className="text-xs bg-stone-700 text-white px-2 py-1 rounded-lg">引継ぐ</button>
                <button onClick={() => setInheritDriver(null)} className="text-xs text-gray-400 px-1">✕</button>
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
              <p className="text-xs font-semibold text-gray-500">🚗 配車当番{groupLabel ? `（${groupLabel}）` : ""}</p>
              <div className="flex gap-1">
                {sortedGroups.map((g) => (
                  <button key={g} type="button"
                    onClick={() => setEditDriverNames(parents.filter((p) => normalizeGroup(p.group) === g).sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName)).map((p) => p.playerName))}
                    className="text-xs px-2 py-0.5 rounded-lg border bg-amber-50 text-amber-800 border-amber-200 font-medium"
                  >{g}</button>
                ))}
              </div>
            </div>
            <MultiSelect names={parentNames} selected={editDriverNames} onChange={setEditDriverNames} />
          </div>
          {inheritEquip && editEquipOut.length === 0 && (
            <div className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <div className="text-xs text-stone-700 min-w-0">
                <span className="font-semibold">前回({fmtDate(inheritEquip.date)})の配車当番</span>を引継ぎますか？
                <div className="flex flex-wrap gap-1 mt-1">
                  {inheritEquip.names.map((n) => <span key={n} className="bg-stone-200 px-1.5 py-0.5 rounded-full">{n}</span>)}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { setEditEquipOut(inheritEquip.names); setInheritEquip(null); }} className="text-xs bg-stone-600 text-white px-2 py-1 rounded-lg">引継ぐ</button>
                <button onClick={() => setInheritEquip(null)} className="text-xs text-gray-400 px-1">✕</button>
              </div>
            </div>
          )}
          <div>
            <div className="flex items-center justify-between mb-1 flex-wrap gap-1">
              <p className="text-xs font-semibold text-gray-500">🎒 備品持帰り</p>
              <div className="flex gap-1">
                {sortedGroups.map((g) => (
                  <button key={g} type="button"
                    onClick={() => setEditEquipOut(parents.filter((p) => normalizeGroup(p.group) === g).sort((a, b) => (a.furigana || a.playerName).localeCompare(b.furigana || b.playerName)).map((p) => p.playerName))}
                    className="text-xs px-2 py-0.5 rounded-lg border bg-stone-50 text-stone-700 border-stone-200 font-medium"
                  >{g}</button>
                ))}
              </div>
            </div>
            <MultiSelect names={parentNames} selected={editEquipOut} onChange={setEditEquipOut} />
          </div>
          <div className="flex gap-2">
            <button onClick={() => saveMatchDuty(m)} disabled={saving} className="flex-1 bg-emerald-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
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

        {activeSwaps.length > 0 && (
          <div className="mb-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
            <p className="text-xs font-semibold text-amber-800 mb-2">当番変更中（担当試合が終わると自動で元に戻ります）</p>
            <div className="space-y-1.5">
              {activeSwaps.map((s) => {
                const slotLabel = s.appliedFromSlotIndex === 0 ? "次回" : `${s.appliedFromSlotIndex + 1}回後`;
                const fromLabel = s.fromDate
                  ? `${fmtDate(s.fromDate)}（${slotLabel}）`
                  : slotLabel;
                const kindLabel = s.kind === "driver" ? "配車起点" : "備品起点";
                const pastCount = s.fromDate ? pastMatches.filter((m) => m.date >= s.fromDate).length : 0;
                const remaining = swapCoverage(s) - pastCount;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-2 bg-white border border-amber-100 rounded-lg px-2.5 py-1.5">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-amber-900">{s.personA} ↔ {s.personB}</span>
                      <span className="text-xs text-gray-400 ml-1.5">{fromLabel}・{kindLabel}</span>
                      <span className="text-xs text-gray-300 ml-1">（残{remaining}回）</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">今後の当番（次{displayCount}回）</p>
        <div className="grid gap-2 mb-5">
          {futureGroups.slice(0, displayCount).map((group, i) => {
            const linkedMatchId = effectiveSlotMatchIds[i];
            const linkedMatch = linkedMatchId ? matches.find((m) => m.id === linkedMatchId) : null;
            const groupMembers = getGroupMembers(group, i, "driver");
            const rawLinkedDrivers = linkedMatchId
              ? drivers.filter((d) => d.matchId === linkedMatchId).map((d) => d.parentName)
              : [];
            const slotDrivers = rawLinkedDrivers.length > 0 ? rawLinkedDrivers : groupMembers;
            const equipGroup = futureGroups[i + 1] ?? "";
            const rawLinkedEquip = linkedMatch?.equipmentBringOut
              ? linkedMatch.equipmentBringOut.split(",").map((s) => s.trim()).filter(Boolean)
              : [];
            const slotEquipOut = rawLinkedEquip.length > 0 ? rawLinkedEquip : getGroupMembers(equipGroup, i, "equip");
            const isEditing = Boolean(linkedMatchId && editMatchId === linkedMatchId);
            const isPicking = pickingSlot === i;
            const slotLabel = i === 0 ? "次回" : `${i + 1}回後`;

            return (
              <div key={i} className={`bg-white rounded-xl border p-3 ${i === 0 ? "border-amber-300 shadow-md" : "border-gray-100 shadow-sm"}`}>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${i === 0 ? "bg-stone-700 text-white" : "bg-gray-200 text-gray-600"}`}>{slotLabel}</span>
                    {group && <span className={groupBadge(group)}>{groupDisplay(group)}</span>}
                    {linkedMatch && (
                      <span className="text-xs text-gray-500 truncate">{fmtDate(linkedMatch.date)}　{linkedMatch.matchName || linkedMatch.matchType}</span>
                    )}
                  </div>
                  {!isEditing && !isPicking && swapSlot !== i && (
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => { setSwapSlot(i); setSwapFrom(""); setSwapTo(""); }}
                        className="text-xs text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg font-medium"
                      >当番変更</button>
                      <button
                        onClick={() => { setPickerNoticeSlot(null); setPickingSlot(i); }}
                        className="text-xs text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-1 rounded-lg font-medium"
                      >
                        {linkedMatch ? "試合変更" : "試合選択"}
                      </button>
                      <button
                        onClick={() => {
                          setSkipOnlyMatchId(null);
                          if (linkedMatch) {
                            startEditMatch(linkedMatch, group, equipGroup, i);
                          } else {
                            setPickerNoticeSlot(i);
                            setPickingSlot(i);
                          }
                        }}
                        className="text-xs text-stone-700 border border-stone-200 px-2 py-1 rounded-lg"
                      >変更</button>
                    </div>
                  )}
                </div>

                {/* 当番変更フォーム */}
                {swapSlot === i && (
                  <div className="space-y-2 mb-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-amber-800">当番変更（{i === 0 ? "次回" : `${i + 1}回後`}以降のすべてのスロットに反映）</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">交代する人</label>
                        <select
                          value={swapFrom}
                          onChange={(e) => setSwapFrom(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">選択</option>
                          {slotDrivers.length > 0 && (
                            <optgroup label="🚗 配車当番">
                              {slotDrivers.map((n) => <option key={`d-${n}`} value={n}>{n}</option>)}
                            </optgroup>
                          )}
                          {slotEquipOut.length > 0 && (
                            <optgroup label="🎒 備品持帰り">
                              {slotEquipOut.filter((n) => !slotDrivers.includes(n)).map((n) => <option key={`e-${n}`} value={n}>{n}</option>)}
                            </optgroup>
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-0.5 block">代わりに入る人</label>
                        <select
                          value={swapTo}
                          onChange={(e) => setSwapTo(e.target.value)}
                          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                        >
                          <option value="">選択</option>
                          {parentNames.filter((n) => n !== swapFrom).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveSwap} disabled={savingSwap || !swapFrom || !swapTo} className="flex-1 bg-amber-600 text-white py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
                        {savingSwap ? "保存中..." : "当番変更を保存"}
                      </button>
                      <button onClick={() => setSwapSlot(null)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded-lg text-xs">キャンセル</button>
                    </div>
                  </div>
                )}

                {/* 試合選択ピッカー */}
                {isPicking && (
                  <div className="space-y-1.5 mb-2">
                    {pickerNoticeSlot === i && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                        編集するには先に試合を選択してください。
                      </div>
                    )}
                    <p className="text-xs text-gray-500 font-semibold">紐づける試合を選択</p>
                    <div className="grid gap-1 max-h-44 overflow-y-auto">
                      {linkedMatch && (
                        <button
                          onClick={async () => {
                            // 配車・備品データをDBからクリア
                            await fetch("/api/drivers", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ matchId: linkedMatchId, parentNames: [] }),
                            });
                            await fetch(`/api/matches/${linkedMatchId}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ ...linkedMatch, equipmentBringOut: "", carCount: 0 }),
                            });
                            setDrivers((prev) => prev.filter((d) => d.matchId !== linkedMatchId));
                            setMatches((prev) => prev.map((m) => m.id === linkedMatchId ? { ...m, equipmentBringOut: "", carCount: 0 } : m));
                            const ids = [...paddedSlotMatchIds]; ids[i] = null; setSlotMatchIds(ids);
                            setPickingSlot(null); setEditMatchId(null); setPickerNoticeSlot(null);
                          }}
                          className="text-xs text-left px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-500 font-medium"
                        >
                          紐づけ解除
                        </button>
                      )}
                      {futureMatchesSorted.map((fm) => (
                        <button
                          key={fm.id}
                          onClick={() => {
                            const ids = [...paddedSlotMatchIds];
                            ids[i] = fm.id;
                            setSlotMatchIds(ids);
                            setPickingSlot(null);
                            setPickerNoticeSlot(null);
                            startEditMatch(fm, group, equipGroup, i);
                          }}
                          className={`text-xs text-left px-2 py-1.5 rounded-lg border ${linkedMatchId === fm.id ? "border-stone-600 bg-stone-100 text-stone-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                        >
                          {fmtDate(fm.date)}　{fm.matchName || fm.matchType}{fm.venue ? ` @ ${fm.venue}` : ""}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => { setPickingSlot(null); setPickerNoticeSlot(null); }} className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg font-medium">キャンセル</button>
                  </div>
                )}

                {isEditing && linkedMatch ? (
                  <EditForm m={linkedMatch} groupLabel={group} />
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSkipOnlyMatchId(null);
                        if (linkedMatch) startEditMatch(linkedMatch, group, equipGroup, i);
                        else { setPickerNoticeSlot(i); setPickingSlot(i); }
                      }}
                      className="text-left rounded-lg p-2 bg-amber-50 border border-amber-100 hover:bg-amber-100 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-gray-400 mb-1">🚗 配車当番</p>
                      <div className="flex flex-wrap gap-1">
                        {slotDrivers.map((n) => <span key={n} className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">{n}</span>)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSkipOnlyMatchId(null);
                        if (linkedMatch) startEditMatch(linkedMatch, group, equipGroup, i);
                        else { setPickerNoticeSlot(i); setPickingSlot(i); }
                      }}
                      className="text-left rounded-lg p-2 bg-stone-50 border border-stone-200 hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      <p className="text-xs text-gray-400 mb-1">🎒 備品持帰り</p>
                      {slotEquipOut.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {slotEquipOut.map((n) => <span key={n} className="text-xs bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
                        </div>
                      ) : <span className="text-xs text-gray-400">−</span>}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 過去の当番 */}
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
                          <button onClick={() => { setSkipOnlyMatchId(null); startEditMatch(m); }} className="text-xs text-stone-700 border border-stone-200 px-2 py-1 rounded-lg">変更</button>
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
                              {matchDrivers.map((n) => <span key={n} className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full">{n}</span>)}
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
                              {equipOut.map((n) => <span key={n} className="text-xs bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded-full">{n}</span>)}
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
  const BucketPanel = () => {
    // bucketOrder順に並べた保護者リスト（0は除外）
    const bucketPeople = parents
      .filter((p) => p.bucketOrder > 0)
      .sort((a, b) => a.bucketOrder - b.bucketOrder)
      .map((p) => p.playerName);

    // 最後にバケツ当番をした人を特定（過去の練習に紐づいたdutyから）
    const pastDuties = duties
      .filter((d) => {
        const pr = practices.find((p) => p.id === d.practiceId);
        if (!pr || pr.date >= today) return false;
        return new Date(pr.date + "T00:00:00").getDay() === 6; // 土曜日のみ
      })
      .sort((a, b) => {
        const pa = practices.find((p) => p.id === a.practiceId);
        const pb = practices.find((p) => p.id === b.practiceId);
        return (pb?.date ?? "").localeCompare(pa?.date ?? "");
      });
    const lastBringPerson = pastDuties[0]?.bringPersonName ?? "";
    const lastIdx = lastBringPerson && bucketPeople.length > 0
      ? bucketPeople.indexOf(lastBringPerson)
      : -1;

    // 次の5人（スロット4回分＋持って帰る人用1人）
    const futurePeople: string[] = [];
    if (bucketPeople.length > 0) {
      for (let i = 0; i < 5; i++) {
        futurePeople.push(bucketPeople[(lastIdx + 1 + i) % bucketPeople.length]);
      }
    }

    // 過去の自主練習（duty有り）を新→旧で表示
    const pastBucketRecords = pastDuties.map((d) => ({
      duty: d,
      practice: practices.find((p) => p.id === d.practiceId)!,
    })).filter((x) => x.practice);

    // 自主練習（土曜日）のみを選択候補に
    const futurePractices = practices
      .filter((p) => {
        if (p.date < today) return false;
        return new Date(p.date + "T00:00:00").getDay() === 6; // 土曜日のみ
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div>
        <h2 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
          <span>🪣</span> バケツ当番
        </h2>

        {bucketPeople.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-6">
            選手マスタでバケツ当番順を設定してください
          </p>
        )}

        {bucketPeople.length > 0 && (
          <>
            <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">今後の当番（次4回）</p>
            <div className="grid gap-2 mb-5">
              {[0, 1, 2, 3].map((i) => {
                const bringPerson = futurePeople[i] ?? "";
                const returnPerson = futurePeople[i + 1] ?? "";
                const linkedPracticeId = slotBucketPracticeIds[i];
                const linkedPractice = linkedPracticeId ? practices.find((p) => p.id === linkedPracticeId) : null;
                const existingDuty = linkedPracticeId ? duties.find((d) => d.practiceId === linkedPracticeId) : null;
                const displayBring = existingDuty?.bringPersonName || bringPerson;
                const displayReturn = existingDuty?.returnPersonName || returnPerson;
                const isEditing = editBucketSlot === i;
                const isPicking = pickingBucketSlot === i;
                const slotLabel = i === 0 ? "次回" : `${i + 1}回後`;

                return (
                  <div key={i} className={`bg-white rounded-xl border p-3 ${i === 0 ? "border-amber-300 shadow-md" : "border-gray-100 shadow-sm"}`}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold shrink-0 ${i === 0 ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-600"}`}>{slotLabel}</span>
                        {linkedPractice ? (
                          <span className="text-xs text-gray-500 truncate">{fmtDate(linkedPractice.date)}　自主練習</span>
                        ) : (
                          <span className="text-xs text-gray-400">日付未定</span>
                        )}
                      </div>
                      {!isEditing && !isPicking && (
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              setEditBucketSlot(i);
                              setEditBring(displayBring);
                              setEditRet(displayReturn);
                            }}
                            className="text-xs text-amber-700 border border-amber-200 px-2 py-1 rounded-lg"
                          >変更</button>
                          <button
                            onClick={() => setPickingBucketSlot(i)}
                            className="text-xs text-stone-700 bg-stone-100 border border-stone-300 px-2.5 py-1 rounded-lg font-medium"
                          >
                            {linkedPractice ? "練習変更" : "練習選択"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 練習選択ピッカー */}
                    {isPicking && (
                      <div className="space-y-1.5 mb-2">
                        <p className="text-xs text-gray-500 font-semibold">紐づける自主練習を選択</p>
                        <div className="grid gap-1 max-h-52 overflow-y-auto">
                          {linkedPractice && (
                            <button
                              onClick={async () => {
                                // バケツ当番データをDBから削除
                                await fetch(`/api/bucket-duties?practiceId=${linkedPracticeId}`, { method: "DELETE" });
                                setDuties((prev) => prev.filter((d) => d.practiceId !== linkedPracticeId));
                                const ids = [...slotBucketPracticeIds];
                                ids[i] = null;
                                setSlotBucketPracticeIds(ids);
                                setPickingBucketSlot(null);
                              }}
                              className="text-xs text-left px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-500 font-medium"
                            >
                              紐づけ解除
                            </button>
                          )}
                          {futurePractices.map((pr) => (
                            <button
                              key={pr.id}
                              onClick={() => {
                                const ids = [...slotBucketPracticeIds];
                                ids[i] = pr.id;
                                setSlotBucketPracticeIds(ids);
                                setPickingBucketSlot(null);
                                const existing = duties.find((d) => d.practiceId === pr.id);
                                setEditBucketSlot(i);
                                setEditBring(existing?.bringPersonName || bringPerson);
                                setEditRet(existing?.returnPersonName || returnPerson);
                              }}
                              className={`text-xs text-left px-2 py-1.5 rounded-lg border ${linkedPracticeId === pr.id ? "border-amber-400 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                            >
                              {fmtDate(pr.date)}　自主練習
                            </button>
                          ))}
                          {futurePractices.length === 0 && (
                            <p className="text-xs text-gray-400 px-2">未来の自主練習がありません</p>
                          )}
                        </div>
                        <button onClick={() => setPickingBucketSlot(null)} className="text-xs text-gray-600 bg-gray-100 border border-gray-200 px-3 py-1.5 rounded-lg font-medium">キャンセル</button>
                      </div>
                    )}

                    {/* 編集フォーム or 表示 */}
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
                        {!linkedPracticeId && (
                          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                            自主練習を選択すると保存できます
                          </p>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => saveBucketSlot(i, linkedPracticeId)}
                            disabled={savingBucket || !linkedPracticeId}
                            className="flex-1 bg-amber-600 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                          >
                            {savingBucket ? "保存中..." : "保存"}
                          </button>
                          <button onClick={() => setEditBucketSlot(null)} className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg text-sm">
                            キャンセル
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg p-2 bg-stone-50 border border-stone-100">
                          <p className="text-xs text-gray-400 mb-0.5">持っていく</p>
                          <p className="text-sm font-semibold text-stone-800">{displayBring || "−"}</p>
                        </div>
                        <div className="rounded-lg p-2 bg-stone-50 border border-stone-100">
                          <p className="text-xs text-gray-400 mb-0.5">持って帰る</p>
                          <p className="text-sm font-semibold text-stone-800">{displayReturn || "−"}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* 過去のバケツ当番 */}
        {pastBucketRecords.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 tracking-wide mb-2">過去のバケツ当番</p>
            <div className="grid gap-2">
              {pastBucketRecords.map(({ duty, practice }) => (
                <div key={duty.id} className="bg-white rounded-xl border border-gray-100 p-3 opacity-70">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full shrink-0">過去</span>
                    <span className="text-sm font-semibold text-gray-500">{fmtDate(practice.date)}</span>
                    <span className="text-xs text-gray-400">自主練習</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg p-2 bg-gray-50">
                      <p className="text-xs text-gray-400 mb-0.5">持っていく</p>
                      <p className="text-sm text-gray-500">{duty.bringPersonName || "−"}</p>
                    </div>
                    <div className="rounded-lg p-2 bg-gray-50">
                      <p className="text-xs text-gray-400 mb-0.5">持って帰る</p>
                      <p className="text-sm text-gray-500">{duty.returnPersonName || "−"}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-8 pt-16 md:pt-8 pb-8">
      <BackHeader title="当番一覧" />

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

import { Suspense } from "react";
export default function DutyRosterPage() {
  return (
    <Suspense>
      <DutyRosterInner />
    </Suspense>
  );
}
