import type { Parent, Practice, BucketDuty } from "@/lib/types";

// 紐付けられた未来の自主練習(土曜)スロット4回分について、
// 実際に確定保存された当番(bucket-duties)が無い場合の予測担当者を計算する。
// 当番一覧・通常練習の両画面で同じ予測結果を表示するための共通ロジック。
export function computeBucketPredictions(
  parents: Parent[],
  practices: Practice[],
  duties: BucketDuty[],
  linkedBucketPracticeIds: string[],
  today: string
): Map<string, { bringPersonName: string; returnPersonName: string }> {
  const bucketPeople = parents
    .filter((p) => p.bucketOrder > 0)
    .sort((a, b) => a.bucketOrder - b.bucketOrder)
    .map((p) => p.playerName);

  const pastDuties = duties
    .filter((d) => {
      const pr = practices.find((p) => p.id === d.practiceId);
      if (!pr || pr.date >= today) return false;
      return new Date(pr.date + "T00:00:00").getDay() === 6;
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

  const futurePeople: string[] = [];
  if (bucketPeople.length > 0) {
    for (let i = 0; i < 5; i++) {
      futurePeople.push(bucketPeople[(lastIdx + 1 + i) % bucketPeople.length]);
    }
  }

  const linkedFuturePractices = practices
    .filter((p) => linkedBucketPracticeIds.includes(p.id) && p.date >= today && new Date(p.date + "T00:00:00").getDay() === 6)
    .sort((a, b) => a.date.localeCompare(b.date));

  const predictions = new Map<string, { bringPersonName: string; returnPersonName: string }>();
  linkedFuturePractices.slice(0, 4).forEach((p, i) => {
    predictions.set(p.id, {
      bringPersonName: futurePeople[i] ?? "",
      returnPersonName: futurePeople[i + 1] ?? "",
    });
  });
  return predictions;
}
