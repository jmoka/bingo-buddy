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
  cardPrice: number; // cost per card in credits TO JOIN
  prize: Prize;
  startTime: string; // ISO date string
  status: MatchStatus;
  playerIds: string[];
  calledNumbers: number[];
  pot: number; // total credits bet
  createdAt: string;
  isAutoCalling?: boolean;
  nextAutoCallTimestamp?: number;
  winnerId?: string;
}

export interface Player {
  id: string;
  name: string;
  credits: number;
  ownedCardIds: string[]; // IDs of PlayerCard
}

// A card template owned by a player
export interface PlayerCard {
  id: string;
  playerId: string;
  name: string;
  numbers: number[][];
  usesLeft: number;
}

// An instance of a card used in a match
export interface MatchCard {
  id: string;
  playerCardId: string; // link to the template
  playerId: string;
  matchId: string;
  name: string; // copied from PlayerCard
  numbers: number[][]; // copied from PlayerCard
  markedNumbers: Set<number>;
}