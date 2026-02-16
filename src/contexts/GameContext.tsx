import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Match, Player, PlayerCard, MatchStatus, Prize } from '@/types/match';
import { GameType } from '@/types/bingo';
import { generateCardId } from '@/utils/bingoUtils';

interface GameContextType {
  // Admin
  isAdmin: boolean;
  adminLogin: (password: string) => boolean;
  adminLogout: () => void;
  createMatch: (match: Omit<Match, 'id' | 'status' | 'playerIds' | 'calledNumbers' | 'pot' | 'createdAt'>) => Match;
  openMatch: (matchId: string) => void;
  startMatch: (matchId: string) => void;
  callNumber: (matchId: string, num: number) => void;
  finishMatch: (matchId: string) => void;
  deleteMatch: (matchId: string) => void;

  // Player
  currentPlayer: Player | null;
  registerPlayer: (name: string) => void;
  logoutPlayer: () => void;
  buyCredits: (amount: number) => void;
  joinMatch: (matchId: string, cardCount: number) => PlayerCard[];
  
  // Data
  matches: Match[];
  players: Player[];
  playerCards: PlayerCard[];
  getMatchCards: (matchId: string) => PlayerCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => PlayerCard[];
}

const GameContext = createContext<GameContextType | null>(null);

const ADMIN_PASSWORD = 'admin123'; // Simple password for demo
const STORAGE_KEYS = {
  matches: 'bingo_matches',
  players: 'bingo_players',
  playerCards: 'bingo_player_cards',
  currentPlayer: 'bingo_current_player',
  isAdmin: 'bingo_is_admin',
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateBingoCard(): number[][] {
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  const grid: number[][] = [];
  for (let row = 0; row < 5; row++) {
    const rowNums: number[] = [];
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        rowNums.push(0); // FREE space
      } else {
        const [min, max] = ranges[col];
        let num: number;
        do {
          num = Math.floor(Math.random() * (max - min + 1)) + min;
        } while (
          grid.some(r => r[col] === num) ||
          rowNums.includes(num)
        );
        rowNums.push(num);
      }
    }
    grid.push(rowNums);
  }
  return grid;
}

// Serialize/deserialize helpers for Sets
function serializeCards(cards: PlayerCard[]): string {
  return JSON.stringify(cards.map(c => ({
    ...c,
    markedNumbers: Array.from(c.markedNumbers),
  })));
}

function deserializeCards(json: string): PlayerCard[] {
  const arr = JSON.parse(json);
  return arr.map((c: any) => ({
    ...c,
    markedNumbers: new Set(c.markedNumbers),
  }));
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.matches);
    return saved ? JSON.parse(saved) : [];
  });

  const [players, setPlayers] = useState<Player[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.players);
    return saved ? JSON.parse(saved) : [];
  });

  const [playerCards, setPlayerCards] = useState<PlayerCard[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.playerCards);
    return saved ? deserializeCards(saved) : [];
  });

  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.currentPlayer);
    return saved ? JSON.parse(saved) : null;
  });

  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_KEYS.isAdmin) === 'true';
  });

  // Persist state
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.playerCards, serializeCards(playerCards));
  }, [playerCards]);

  useEffect(() => {
    if (currentPlayer) {
      localStorage.setItem(STORAGE_KEYS.currentPlayer, JSON.stringify(currentPlayer));
    } else {
      localStorage.removeItem(STORAGE_KEYS.currentPlayer);
    }
  }, [currentPlayer]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.isAdmin, String(isAdmin));
  }, [isAdmin]);

  // Sync currentPlayer with players array
  useEffect(() => {
    if (currentPlayer) {
      const updated = players.find(p => p.id === currentPlayer.id);
      if (updated && (updated.credits !== currentPlayer.credits || updated.name !== currentPlayer.name)) {
        setCurrentPlayer(updated);
      }
    }
  }, [players, currentPlayer]);

  // Admin functions
  const adminLogin = useCallback((password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      setIsAdmin(true);
      return true;
    }
    return false;
  }, []);

  const adminLogout = useCallback(() => {
    setIsAdmin(false);
  }, []);

  const createMatch = useCallback((data: Omit<Match, 'id' | 'status' | 'playerIds' | 'calledNumbers' | 'pot' | 'createdAt'>): Match => {
    const match: Match = {
      ...data,
      id: generateId(),
      status: 'waiting',
      playerIds: [],
      calledNumbers: [],
      pot: 0,
      createdAt: new Date().toISOString(),
    };
    setMatches(prev => [...prev, match]);
    return match;
  }, []);

  const openMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'open' as MatchStatus } : m));
  }, []);

  const startMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'in_progress' as MatchStatus } : m));
  }, []);

  const callNumber = useCallback((matchId: string, num: number) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== matchId) return m;
      if (m.calledNumbers.includes(num)) return m;
      return { ...m, calledNumbers: [...m.calledNumbers, num] };
    }));

    // Mark numbers on player cards
    setPlayerCards(prev => prev.map(card => {
      if (card.matchId !== matchId) return card;
      const newMarked = new Set(card.markedNumbers);
      card.numbers.flat().forEach(n => {
        if (n === num || n === 0) newMarked.add(n);
      });
      return { ...card, markedNumbers: newMarked };
    }));
  }, []);

  const finishMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'finished' as MatchStatus } : m));
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setPlayerCards(prev => prev.filter(c => c.matchId !== matchId));
  }, []);

  // Player functions
  const registerPlayer = useCallback((name: string) => {
    const existing = players.find(p => p.name === name);
    if (existing) {
      setCurrentPlayer(existing);
      return;
    }
    const player: Player = {
      id: generateId(),
      name,
      credits: 100, // Start with 100 credits
      ownedCardIds: [],
    };
    setPlayers(prev => [...prev, player]);
    setCurrentPlayer(player);
  }, [players]);

  const logoutPlayer = useCallback(() => {
    setCurrentPlayer(null);
  }, []);

  const buyCredits = useCallback((amount: number) => {
    if (!currentPlayer) return;
    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits + amount } : p));
  }, [currentPlayer]);

  const joinMatch = useCallback((matchId: string, cardCount: number): PlayerCard[] => {
    if (!currentPlayer) return [];
    
    const match = matches.find(m => m.id === matchId);
    if (!match || match.status !== 'open') return [];

    const totalCost = cardCount * match.cardPrice;
    if (currentPlayer.credits < totalCost) return [];

    // Debit credits
    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits - totalCost } : p));

    // Add to pot
    setMatches(prev => prev.map(m => m.id === matchId ? { 
      ...m, 
      pot: m.pot + totalCost,
      playerIds: m.playerIds.includes(currentPlayer.id) ? m.playerIds : [...m.playerIds, currentPlayer.id]
    } : m));

    // Generate cards
    const newCards: PlayerCard[] = [];
    for (let i = 0; i < cardCount; i++) {
      const card: PlayerCard = {
        id: generateCardId(),
        playerId: currentPlayer.id,
        matchId,
        numbers: generateBingoCard(),
        markedNumbers: new Set([0]), // FREE space
      };
      newCards.push(card);
    }

    setPlayerCards(prev => [...prev, ...newCards]);
    return newCards;
  }, [currentPlayer, matches]);

  const getMatchCards = useCallback((matchId: string) => {
    return playerCards.filter(c => c.matchId === matchId);
  }, [playerCards]);

  const getPlayerMatchCards = useCallback((matchId: string, playerId: string) => {
    return playerCards.filter(c => c.matchId === matchId && c.playerId === playerId);
  }, [playerCards]);

  return (
    <GameContext.Provider value={{
      isAdmin,
      adminLogin,
      adminLogout,
      createMatch,
      openMatch,
      startMatch,
      callNumber,
      finishMatch,
      deleteMatch,
      currentPlayer,
      registerPlayer,
      logoutPlayer,
      buyCredits,
      joinMatch,
      matches,
      players,
      playerCards,
      getMatchCards,
      getPlayerMatchCards,
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
