import React, { createContext, useContext, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { Match, PlayerCard, MatchCard, Winner, MatchStatus } from '@/types/match';
import { BingoCard, GameType, WinResult } from '@/types/bingo';
import { checkWin } from '@/utils/bingoUtils';
import { toast } from 'sonner';
import { Profile } from './AuthContext';

interface GameSettings {
  id: string;
  singleton: boolean;
  custo_nova_cartela: number;
  custo_recarga_cartela: number;
  usos_por_recarga: number;
  intervalo_sorteio_auto_seg: number;
  created_at: string;
}

interface GameContextType {
  matches: Match[];
  players: Profile[];
  playerCards: PlayerCard[];
  matchCards: MatchCard[];
  gameSettings: GameSettings | undefined;
  isLoading: boolean;
  createMatch: (data: any) => Promise<void>;
  openMatch: (matchId: string) => Promise<void>;
  startMatch: (matchId: string) => Promise<void>;
  callNumber: (matchId: string, num: number) => Promise<void>;
  finishMatch: (matchId: string) => Promise<void>;
  deleteMatch: (matchId: string) => Promise<void>;
  toggleAutoCall: (matchId: string) => Promise<void>;
  updateGameSettings: (newSettings: Partial<GameSettings>) => Promise<void>;
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
      const { data, error } = await supabase.from('partidas').select('*').order('start_time', { ascending: false });
      if (error) throw error;
      return data as Match[];
    },
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data, error } = await supabase.from('perfis').select('*');
      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!profile && profile.role === 'admin',
  });

  const { data: playerCards = [], isLoading: l2 } = useQuery({
    queryKey: ['playerCards', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('cartelas_jogador').select('*').eq('player_id', user.id);
      if (error) throw error;
      return data as PlayerCard[];
    },
    enabled: !!user,
  });

  const { data: matchCards = [], isLoading: l3 } = useQuery({
    queryKey: ['matchCards'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cartelas_partida').select('*');
      if (error) throw error;
      return data.map(c => ({ ...c, marked_numbers: new Set(c.marked_numbers || []) })) as MatchCard[];
    },
  });

  const { data: gameSettings, isLoading: l4 } = useQuery({
    queryKey: ['gameSettings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('configuracoes').select('*').limit(1).single();
      if (error) {
        console.error("Error fetching settings, using defaults", error);
        return {
          custo_nova_cartela: 10,
          custo_recarga_cartela: 5,
          usos_por_recarga: 1,
          intervalo_sorteio_auto_seg: 120,
        } as GameSettings;
      }
      return data as GameSettings;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  useEffect(() => {
    const channel = supabase.channel('public-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        queryClient.invalidateQueries({ queryKey: ['playerCards'] });
        queryClient.invalidateQueries({ queryKey: ['matchCards'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['players'] });
        if (payload.table === 'configuracoes') {
          queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const createMatch = async (data: any) => {
    const { error } = await supabase.from('partidas').insert([{ ...data, status: 'waiting' }]);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Partida criada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const updateMatchStatus = async (matchId: string, status: MatchStatus) => {
    const { error } = await supabase.from('partidas').update({ status }).eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const openMatch = (matchId: string) => updateMatchStatus(matchId, 'open');
  const startMatch = (matchId: string) => updateMatchStatus(matchId, 'in_progress');
  const finishMatch = (matchId: string) => updateMatchStatus(matchId, 'finished');

  const deleteMatch = async (matchId: string) => {
    const { error } = await supabase.from('partidas').delete().eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Partida excluída.");
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const toggleAutoCall = async (matchId: string) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || !gameSettings) return;
    const isEnabling = !match.is_auto_calling;
    const { error } = await supabase.from('partidas').update({
      is_auto_calling: isEnabling,
      next_auto_call_timestamp: isEnabling ? new Date(Date.now() + gameSettings.intervalo_sorteio_auto_seg * 1000).toISOString() : null,
    }).eq('id', matchId);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
    }
  };

  const callNumber = async (matchId: string, num: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match || match.called_numbers.includes(num)) return;

    // 1. Find all player cards in this match that have the new number and update them
    const cardsToUpdate = matchCards.filter(c =>
        c.match_id === matchId &&
        c.numbers.flat().includes(num) &&
        !c.marked_numbers.has(num)
    );

    if (cardsToUpdate.length > 0) {
        const updatePromises = cardsToUpdate.map(card => {
            const newMarkedNumbers = Array.from(card.marked_numbers);
            newMarkedNumbers.push(num);
            return supabase
                .from('cartelas_partida')
                .update({ marked_numbers: newMarkedNumbers })
                .eq('id', card.id);
        });
        await Promise.all(updatePromises);
    }

    // 2. Invalidate and refetch card data to check for winners with the latest state
    await queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    const freshMatchCards = await queryClient.fetchQuery<MatchCard[]>({ queryKey: ['matchCards'] });

    // 3. Check for winners
    const cardsInMatch = freshMatchCards.filter(c => c.match_id === matchId);
    const foundWinners: { card: MatchCard, result: WinResult }[] = [];

    for (const card of cardsInMatch) {
        const tempBingoCard: BingoCard = {
            id: card.id,
            name: card.name,
            numbers: card.numbers,
            markedNumbers: card.marked_numbers,
        };
        const winResult = checkWin(tempBingoCard, match.game_type);
        if (winResult) {
            foundWinners.push({ card, result: winResult });
        }
    }

    // 4. Prepare a single update payload for the match
    const newCalledNumbers = [...match.called_numbers, num];
    let matchUpdatePayload: Partial<Match> = { called_numbers: newCalledNumbers };

    if (foundWinners.length > 0 && match.status !== 'finished') {
        const winnerData: Winner[] = foundWinners.map(fw => ({
            playerId: fw.card.player_id,
            playerName: players?.find(p => p.id === fw.card.player_id)?.full_name || 'Desconhecido',
            cardId: fw.card.id,
            cardName: fw.card.name,
        }));

        matchUpdatePayload = {
            ...matchUpdatePayload,
            status: 'finished',
            winners: winnerData,
            is_auto_calling: false
        };
        toast.success('BINGO! Temos um vencedor!');
    }

    // 5. Update the match with new numbers and potential winners
    const { error: updateMatchError } = await supabase
        .from('partidas')
        .update(matchUpdatePayload)
        .eq('id', matchId);

    if (updateMatchError) {
        toast.error(updateMatchError.message);
    }

    // 6. Final invalidation to ensure all clients get the latest match state
    queryClient.invalidateQueries({ queryKey: ['matches'] });
  };

  const buyCredits = async (amount: number) => {
    if (!profile) return;
    const { error } = await supabase.from('perfis').update({ credits: profile.credits + amount }).eq('id', profile.id);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    }
  };

  const createPlayerCard = async (options: { name: string; numbers: number[][]; }): Promise<PlayerCard | null> => {
    if (!user || !profile || !gameSettings || profile.credits < gameSettings.custo_nova_cartela) {
      toast.error('Créditos insuficientes!');
      return null;
    }
    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_nova_cartela }).eq('id', user.id);
    if (creditError) { toast.error(creditError.message); return null; }

    const newCard = { player_id: user.id, ...options, uses_left: 1 };
    const { data, error } = await supabase.from('cartelas_jogador').insert(newCard).select().single();
    if (error) { toast.error(error.message); return null; }
    
    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return data as PlayerCard;
  };

  const joinMatch = async (matchId: string, playerCardIds: string[]): Promise<MatchCard[] | null> => {
    if (!user || !profile) return null;
    const match = matches.find(m => m.id === matchId);
    if (!match) { toast.error("Partida não encontrada"); return null; }

    const totalCost = playerCardIds.length * match.card_price;
    if (profile.credits < totalCost) { toast.error("Créditos insuficientes!"); return null; }

    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - totalCost }).eq('id', user.id);
    if (creditError) { toast.error(creditError.message); return null; }

    for (const cardId of playerCardIds) {
      const card = playerCards.find(c => c.id === cardId);
      if (card) await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left - 1 }).eq('id', cardId);
    }

    const newMatchCards = playerCardIds.map(cardId => {
      const card = playerCards.find(c => c.id === cardId);
      return {
        player_id: user.id,
        match_id: matchId,
        player_card_id: cardId,
        name: card?.name,
        numbers: card?.numbers,
        marked_numbers: [],
      };
    });

    const { data, error } = await supabase.from('cartelas_partida').insert(newMatchCards).select();
    if (error) { toast.error(error.message); return null; }

    await supabase.from('partidas').update({ pot: match.pot + totalCost }).eq('id', matchId);
    
    queryClient.invalidateQueries({ queryKey: ['matchCards'] });
    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['matches'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });

    return data as MatchCard[];
  };

  const buyCardUses = async (playerCardId: string): Promise<boolean> => {
    if (!profile || !gameSettings || profile.credits < gameSettings.custo_recarga_cartela) {
      toast.error('Créditos insuficientes!');
      return false;
    }
    const { error: creditError } = await supabase.from('perfis').update({ credits: profile.credits - gameSettings.custo_recarga_cartela }).eq('id', profile.id);
    if (creditError) { toast.error(creditError.message); return false; }

    const card = playerCards.find(c => c.id === playerCardId);
    if (card) {
      const { error } = await supabase.from('cartelas_jogador').update({ uses_left: card.uses_left + gameSettings.usos_por_recarga }).eq('id', playerCardId);
      if (error) { toast.error(error.message); return false; }
    }

    queryClient.invalidateQueries({ queryKey: ['playerCards'] });
    queryClient.invalidateQueries({ queryKey: ['profile'] });
    return true;
  };

  const updateGameSettings = async (newSettings: Partial<GameSettings>) => {
    const { error } = await supabase.from('configuracoes').update(newSettings).eq('singleton', true);
    if (error) {
        toast.error(error.message);
    } else {
        toast.success("Configurações salvas com sucesso!");
        queryClient.invalidateQueries({ queryKey: ['gameSettings'] });
    }
  };

  const getMatchCards = (matchId: string) => matchCards.filter(c => c.match_id === matchId);
  const getPlayerMatchCards = (matchId: string, playerId: string) => matchCards.filter(c => c.match_id === matchId && c.player_id === playerId);

  return (
    <GameContext.Provider value={{
      matches, players, playerCards, matchCards, gameSettings, isLoading: l1 || l2 || l3 || l4,
      createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, toggleAutoCall,
      updateGameSettings, createPlayerCard, joinMatch, buyCardUses, buyCredits,
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