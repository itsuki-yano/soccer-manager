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
}

export interface Driver {
  matchId: string;
  parentName: string;
}

export interface Parent {
  id: string;
  playerName: string;
  furigana: string;
  jerseyNumber: string;
  carCapacity: number;
  group: string;
}

export interface CoachExpense {
  id: string;
  date: string;
  description: string;
  amount: number;
  claimed: string;
}

export interface Settings {
  teamName: string;
  gasPricePerKm: number;
  accountant: string;
  leagueName: string;
  logoUrl: string;
  bucketDutyStartDate: string;
  bucketDutyEndDate: string;
}

export interface Practice {
  id: string;
  date: string;
  type: string; // "通常練習" | "自主練習"
  venue: string;
  startTime: string;
  endTime: string;
  bandUid: string;
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
