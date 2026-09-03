import type { Parent, Practice, BucketDuty } from "@/lib/types";

// 「今回だけお休み」にする人（練習ごと）
export type BucketSkip = { practiceId: string; names: string[] };

// 紐付けられた未来の自主練習スロット4回分について、
// 実際に確定保存された当番(bucket-duties)が無い場合の予測担当者を計算する。
// 当番一覧・通常練習の両画面で同じ予測結果を表示するための共通ロジック。
export function computeBucketPredictions(
  parents: Parent[],
  practices: Practice[],
  duties: BucketDuty[],
  linkedBucketPracticeIds: string[],
  today: string,
  skips: BucketSkip[] = []
): Map<string, { bringPersonName: string; returnPersonName: string }> {
  const bucketPeople = parents
    .filter((p) => p.bucketOrder > 0)
    .sort((a, b) => a.bucketOrder - b.bucketOrder)
    .map((p) => p.playerName);

  const pastDuties = duties
    .filter((d) => {
      const pr = practices.find((p) => p.id === d.practiceId);
      if (!pr || pr.date >= today) return false;
      return pr.type === "自主練習"; // 曜日ではなく種別で判定
    })
    .sort((a, b) => {
      const pa = practices.find((p) => p.id === a.practiceId);
      const pb = practices.find((p) => p.id === b.practiceId);
      return (pb?.date ?? "").localeCompare(pa?.date ?? "");
    });
  // 直近にバケツ当番をした人の位置。退団などでマスタに居ない人だった場合は
  // ローテーションが先頭に戻ってしまうため、さらに前の回までさかのぼって基準を決める
  let lastIdx = -1;
  for (const d of pastDuties) {
    const i = bucketPeople.indexOf(d.bringPersonName ?? "");
    if (i >= 0) { lastIdx = i; break; }
  }

  const linkedFuturePractices = practices
    .filter((p) => linkedBucketPracticeIds.includes(p.id) && p.date >= today && p.type === "自主練習")
    .sort((a, b) => a.date.localeCompare(b.date));

  // これから予定されている回に付いているスキップだけを有効にする。
  // 練習日が過ぎればこの集合から外れるので、翌巡では自動的に元の順番に戻る。
  const upcomingIds = new Set(linkedFuturePractices.map((p) => p.id));
  const skipped = new Set(
    skips.filter((s) => upcomingIds.has(s.practiceId)).flatMap((s) => s.names)
  );
  // 全員スキップになると誰も割り当てられないため、その場合はスキップ無しとして扱う
  const rotation = bucketPeople.filter((n) => !skipped.has(n));
  const people = rotation.length > 0 ? rotation : bucketPeople;

  // スキップで人が抜けても順番の連続性を保つため、基準は元の並びから探し直す
  let startIdx = 0;
  if (lastIdx >= 0 && people.length > 0) {
    for (let k = 1; k <= bucketPeople.length; k++) {
      const cand = bucketPeople[(lastIdx + k) % bucketPeople.length];
      const pos = people.indexOf(cand);
      if (pos >= 0) { startIdx = pos; break; }
    }
  }

  const futurePeople: string[] = [];
  if (people.length > 0) {
    for (let i = 0; i < 5; i++) {
      futurePeople.push(people[(startIdx + i) % people.length]);
    }
  }

  const predictions = new Map<string, { bringPersonName: string; returnPersonName: string }>();
  linkedFuturePractices.slice(0, 4).forEach((p, i) => {
    predictions.set(p.id, {
      bringPersonName: futurePeople[i] ?? "",
      returnPersonName: futurePeople[i + 1] ?? "",
    });
  });
  return predictions;
}
