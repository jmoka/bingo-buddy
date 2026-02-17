import { GameType } from './bingo';

export type MatchStatus = 'waiting' | 'open' | 'in_progress' | 'finished';
export type PrizeType = 'product' | 'fixed' | 'percentage';

export interface Prize {
  type: PrizeType;
  value: number | null;
  productName?: string;
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
  card_price: number;
  prize: Prize;
  start_time: string;
  status: MatchStatus;
  called_numbers: number[];
  pot: number;
  created_at: string;
  is_auto_calling?: boolean;
  next_auto_call_timestamp?: number;
  winners: Winner[];
}

export interface PlayerCard {
  id: string;
  player_id: string;
  name: string;
  numbers: number[][];
  uses_left: number;
  is_archived: boolean;
}

export interface MatchCard {
  id:string;
  player_card_id: string;
  player_id: string;
  match_id: string;
  name: string;
  numbers: number[][];
  marked_numbers: Set<number>;
}

export interface Win {
  id: string;
  match_id: string;
  player_id: string;
  player_card_id: string;
  match_card_id: string;
  prize_details: Prize;
  won_at: string;
}

export interface CreditRequestMessage {
  id: string;
  credit_request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

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
  perfis?: {
    full_name: string;
    avatar_url: string;
  };
  mensagens?: CreditRequestMessage[];
}

// Novos tipos para Resgate
export interface RedeemRequestMessage {
  id: string;
  redeem_request_id: string;
  sender_id: string;
  message: string;
  created_at: string;
}

export interface RedeemRequest {
  id: string;
  player_id: string;
  status: 'pending' | 'approved' | 'rejected';
  credits_requested: number;
  amount_to_receive: number;
  receipt_url: string | null;
  requested_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  notes: string | null;
  resubmission_notes: string | null;
  perfis?: {
    full_name: string;
    avatar_url: string;
  };
}