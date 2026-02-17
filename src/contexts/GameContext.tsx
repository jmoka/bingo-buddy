import React, { createContext, useContext, useCallback, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Winner, MatchStatus } from '@/types/match';
import { BingoCard, GameType, WinResult } from '@/types/bingo';
import { checkWin } from '@/utils/bingoUtils';
import { toast } from 'sonner';

// This can be moved to a settings table in the future
const gameSettings = {
  newCardCost: 10,
  cardRechargeCost: 5,
  usesPerRecharge: 1,
  autoCallIntervalSeconds: 120,
};

interface GameContextType {
  matches: Match[];
  playerCards: PlayerCard[];
  matchCards: MatchCard[];
  isLoading: boolean;
  createMatch: (data: Omit<Match, 'id' | 'status' | 'playerIds' | 'calledNumbers' | 'pot' | 'createdAt' | 'isAutoCalling' | 'nextAutoCallTimestamp' | 'winners'>) => Promise<void>;
  openMatch: (matchId: string) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  callNumber: (matchId: string, num: number) => Promise<void>;
  finishMatch: (matchId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  toggleAutoCall: (matchId: string) => Promise<void>;
  createPlayerCard: (options: { name: string; numbers: number[][]; }) => Promise<PlayerCard | null>;
  joinMatch: (matchId: string, playerCardIds: string[]) => Promise<MatchCard[] | null>;
  buyCardUses: (playerCardId: string) => Promise<boolean>;
  buyCredits: (amount: number) => Promise<void>;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: matches = [], isLoading: l1 } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: playerCards = [], isLoading: l2 } = useQuery({
    queryKey: ['playerCards', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('player_cards').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: !!user,
  });

  const { data: matchCards = [], isLoading: l3 } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('match_cards').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, markedNumbers: new Set(c.marked_numbers || [0]) })) as MatchCard[];
    },
  });

  useEffect(() => {
    const channel = supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        console.log('Realtime event:', payload);
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.invalidateQueries({ queryKey: ['playerCards'] });
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createMatch = async (data: any) => {
    const { error } = await supabase.from('matches').insert([{ ...data, status: 'waiting' }]);
    if (error) toast.error(error.message);
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    const { error } = await supabase.from('matches').update({ status }).eq('id', matchId);
    if (error) toast.error(error.message);
  };

  const openMatch = (matchId: string) => updateMatchStatus(matchId, 'open');
  const startMatch = (matchId: string) => updateMatchStatus(matchId, 'in_progress');
  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('matches').delete().eq('id', matchId);
    if (error) toast.error(error.message);
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;
    const isEnabling = !match.is_auto_calling;
    const { error } = await supabase.from('matches').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.autoCallIntervalSeconds * 1000).toISOString() : null,
    }).eq('id', matchId);
    if (error) toast.error(error.message);
  };

  const callNumber = async (matchId: string, num: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.called_numbers.includes(num)) return;

    const newCalledNumbers = [...match.called_numbers, num];
    const { error: updateError } = await supabase.from('matches').update({ called_numbers: newCalledNumbers }).eq('id', matchId);
    if (updateError) { toast.error(updateError.message); return; }

    const cardsInMatch = matchCards.filter(c => c.matchId === matchId);
    const foundWinners: { card: MatchCard, result: WinResult }[] = [];

    for (const card of cardsInMatch) {
      const tempBingoCard: BingoCard = {
        id: card.id,
        name: card.name,
        numbers: card.numbers,
        markedNumbers: new Set([...(card.markedNumbers || []), num]),
      };
      const winResult = checkWin(tempBingoCard, match.game_type);
      if (winResult) foundWinners.push({ card, result: winResult });
    }

    if (foundWinners.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*');
      const winnerData: Winner[] = foundWinners.map(fw => ({
        playerId: fw.card.playerId,
        playerName: profiles?.find(p => p.id === fw.card.playerId)?.full_name || 'Desconhecido',
        cardId: fw.card.id,
        cardName: fw.card.name,
      }));

      await supabase.from('matches').update({ status: 'finished', winners: winnerData, is_auto_calling: false }).eq('id', matchId);
      toast.success('BINGO! Temos um vencedor!');
    }
  };

  const buyCredits = async (amount: number) => {
    if (!profile) return;
    const { error } = await supabase.from('profiles').update({ credits: profile.credits + amount }).eq('id', profile.id);
    if (error) toast.error(error.message);
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }): Promise<PlayerCard | null> => {
    if (!user || !profile || profile.credits < gameSettings.newCardCost) {
      toast.error('Créditos insuficientes!');
      return null;
    }
    const { error: creditError } = await supabase.from('profiles').update({ credits: profile.credits - gameSettings.newCardCost }).eq('id', user.id);
    if (creditError) { toast.error(creditError.message); return null; }

    const newCard = { player_id: user.id, ...options, uses_left: 1 };
    const { data, error } = await supabase.from('player_cards').insert(newCard).select().single();
    if (error) { toast.error(error.message); return null; }
    return data as PlayerCard;
  };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    if (!user || !profile) return null;
    const match = matches.find(m => m.id === matchId);
    if (!match) { toast.error("Partida não encontrada"); return null; }

    const totalCost = playerCardIds.length * match.cardPrice;
    if (profile.credits < totalCost) { toast.error("Créditos insuficientes!"); return null; }

    // This should be an Edge Function for atomicity, but doing it client-side for now.
    const { error: creditError } = await supabase.from('profiles').update({ credits: profile.credits - totalCost }).eq('id', user.id);
    if (creditError) { toast.error(creditError.message); return null; }

    for (const cardId of playerCardIds) {
      const card = playerCards.find(c => c.id === cardId);
      if (card) await supabase.from('player_cards').update({ uses_left: card.uses_left - 1 }).eq('id', cardId);
    }

    const newMatchCards = playerCardIds.map(cardId => {
      const card = playerCards.find(c => c.id === cardId);
      return {
        player_id: user.id,
        match_id: matchId,
        player_card_id: cardId,
        name: card?.name,
        numbers: card?.numbers,
        marked_numbers: [0],
      };
    });

    const { data, error } = await supabase.from('match_cards').insert(newMatchCards).select();
    if (error) { toast.error(error.message); return null; }

    await supabase.from('matches').update({ pot: match.pot + totalCost }).eq('id', matchId);
    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string): Promise<boolean> => {
    if (!profile || profile.credits < gameSettings.cardRechargeCost) {
      toast.error('Créditos insuficientes!');
      return false;
    }
    const { error: creditError } = await supabase.from('profiles').update({ credits: profile.credits - gameSettings.cardRechargeCost }).eq('id', profile.id);
    if (creditError) { toast.error(creditError.message); return false; }

    const card = playerCards.find(c => c.id === playerCardId);
    if (card) {
      const { error } = await supabase.from('player_cards').update({ uses_left: card.uses_left + gameSettings.usesPerRecharge }).eq('id', playerCardId);
      if (error) { toast.error(error.message); return false; }
    }
    return true;
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.matchId === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.matchId === matchId && c.playerId === playerId);

  return (
    <GameContext.Provider value={{
      matches, playerCards, matchCards, isLoading: l1 || l2 || l3,
      createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      createPlayerCard, joinMatch, buyCardUses, buyCredits,
      getMatchCards, getPlayerMatchCards,
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextType => {
  const context = useContext(GameContext);
  if (!context) throw new Error('useGame must be used within GameProvider');
  return context;
};