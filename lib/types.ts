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
}

export interface Driver {
  matchId: string;
  parentName: string;
}

export interface Parent {
  id: string;
  playerName: string;
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
}
