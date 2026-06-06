export interface Match {
  id: string;
  date: string;
  matchName: string;
  opponent: string;
  venue: string;
  address: string;
  distanceKm: number;
  carCount: number;
  accountant: string;
}

export interface Driver {
  matchId: string;
  parentName: string;
}

export interface Parent {
  id: string;
  parentName: string;
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
