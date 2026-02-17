import { GameType } from './bingo';

export type MatchStatus = 'waiting' | 'open' | 'in_progress' | 'finished';
export type PrizeType = 'product' | 'fixed' | 'percentage';

export interface Prize {
  type: PrizeType;
  value: number | null; // fixed amount or percentage
  productName?: string; // if type is 'product'
}

export interface Winner {
  playerId: string;
  playerName:string;
  cardId: string;
  cardName: string;
}

export interface Match {
  id: string;
  name: string;
  game_type: GameType;
  max_cards_per_player: number;
  card_price: number; // cost per card in credits TO JOIN
  prize: Prize;
  start_time: string; // ISO date string
  status: MatchStatus;
  called_numbers: number[];
  pot: number; // total credits bet
  created_at: string;
  is_auto_calling?: boolean;
  next_auto_call_timestamp?: number;
  winners: Winner[];
}

// A card template owned by a player
export interface PlayerCard {
  id: string;
  player_id: string;
  name: string;
  numbers: number[][];
  uses_left: number;
  is_archived: boolean;
}

// An instance of a card used in a match
export interface MatchCard {
  id:string;
  player_card_id: string; // link to the template
  player_id: string;
  match_id: string;
  name: string; // copied from PlayerCard
  numbers: number[][]; // copied from PlayerCard
  marked_numbers: Set<number>;
}

// A record of a win
export interface Win {
  id: string;
  match_id: string;
  player_id: string;
  player_card_id: string;
  match_card_id: string;
  prize_details: Prize;
  won_at: string;
}

// A credit request from a player
export interface CreditRequest {
  id: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected';
  receipt_url: string;
  credits_granted: number | null;
  credits_requested: number | null;
  amount_paid: number | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  resubmission_notes: string | null;
  // Joined data
  perfis?: {
    full_name: string;
    avatar_url: string;
  };
}