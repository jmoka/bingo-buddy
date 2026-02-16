import { GameType } from './bingo';

export type MatchStatus = 'waiting' | 'open' | 'in_progress' | 'finished';
export type PrizeType = 'product' | 'fixed' | 'percentage';

export interface Prize {
  type: PrizeType;
  value: number; // fixed amount or percentage
  productName?: string; // if type is 'product'
}

export interface Match {
  id: string;
  name: string;
  gameType: GameType;
  maxCardsPerPlayer: number;
  cardPrice: number; // cost per card in credits
  prize: Prize;
  startTime: string; // ISO date string
  status: MatchStatus;
  playerIds: string[];
  calledNumbers: number[];
  winnerId?: string;
  pot: number; // total credits bet
  createdAt: string;
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  ownedCardIds: string[]; // card IDs the player owns
}

export interface PlayerCard {
  id: string;
  playerId: string;
  matchId: string;
  numbers: number[][]; // 5x5 grid
  markedNumbers: Set<number>;
}
