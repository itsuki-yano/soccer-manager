export interface Match {
  id: string;
  date: string;
  matchType: string;
  matchName: string;
  opponent: string;
  venue: string;
  address: string;
  distanceKm: number;
  carCount: number;
  needsSettlement: boolean;
  bandUid: string;
  equipmentBringIn: string;
  equipmentBringOut: string;
  settlementStatus: string; // "" | "請求中" | "精算済み"
  skippedDrivers: string; // スキップした配車当番（カンマ区切り）
  bandUrl1: string; // BAND投稿リンク1
  bandUrl2: string; // BAND投稿リンク2
}

export interface Driver {
  matchId: string;
  parentName: string;
}

export interface Parent {
  id: string;
  playerName: string;
  furigana: string;
  jerseyNumber: string;      // 練習着番号
  uniformNumber: string;     // ユニフォーム番号
  carCapacity: number;
  group: string;
  bucketOrder: number;
  blueBibsNumber: string;    // 青ビブス番号
  yellowBibsNumber: string;  // 黄ビブス番号
}

export interface CoachExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  claimed: string;
  purchaserName: string; // 購入者名（個人購入の場合）
  receiptUrl: string;    // レシート画像URL
}

export interface Settings {
  teamName: string;
  gasPricePerKm: number;
  accountant: string;
  leagueName: string;
  logoUrl: string;
  bucketDutyStartDate: string;
  bucketDutyEndDate: string;
  leagueTableUrl: string; // junior-soccer.jp のリーグ戦績表URL
}

export interface Practice {
  id: string;
  date: string;
  type: string; // "通常練習" | "自主練習"
  venue: string;
  startTime: string;
  endTime: string;
  bandUid: string;
  address: string; // 練習場の住所
  bandUrl: string; // BAND投稿リンク
}

export interface DutySwap {
  id: string;
  personA: string; // 交代する人（起点で外れる人）
  personB: string; // 代わりに入る人（代役）
  appliedFromSlotIndex: number; // 何番目のスロットを起点にするか（0=次回）
  fromDate: string; // スワップ開始日（試合日またはtoday）- 有効期限計算に使用
  kind: "driver" | "equip"; // 起点が配車当番か備品持帰りか
  returnSlotIndex: number; // 配車スワップ時、代役Bの班が次に配車を担当するスロット番号（備品は i+1 固定で未使用）
}

export interface BucketDuty {
  id: string;
  practiceId: string;
  bringPersonName: string;
  returnPersonName: string;
}

export interface Memo {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Fee {
  id: string;
  name: string;
  category: string;
  amount: number;
  date: string;
  description: string;
}

export interface FeePayment {
  feeId: string;
  parentId: string;
  paid: boolean;
  paidAt: string;
}

export interface Equipment {
  id: string;
  name: string;
  quantity: number;
  memo: string;
  parentId: string;
  order: number;
  imageUrl: string;
}
