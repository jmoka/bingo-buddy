import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Match, Player, PlayerCard, MatchCard, MatchStatus } from '@/types/match';
import { GameType } from '@/types/bingo';
import { generateCardId } from '@/utils/bingoUtils';

interface GameSettings {
  newCardCost: number;
  cardRechargeCost: number;
  usesPerRecharge: number;
}

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
  updateGameSettings: (settings: GameSettings) => void;

  // Player
  currentPlayer: Player | null;
  registerPlayer: (name: string) => void;
  logoutPlayer: () => void;
  buyCredits: (amount: number) => void;
  createPlayerCard: (options: { name: string, numbers: number[][] }) => PlayerCard | null;
  joinMatch: (matchId: string, playerCardIds: string[]) => MatchCard[];
  buyCardUses: (playerCardId: string) => boolean;
  
  // Data
  matches: Match[];
  players: Player[];
  playerCards: PlayerCard[]; // Owned cards
  matchCards: MatchCard[]; // Cards in matches
  gameSettings: GameSettings;
  getMatchCards: (matchId: string) => MatchCard[];
  getPlayerMatchCards: (matchId: string, playerId: string) => MatchCard[];
}

const GameContext = createContext<GameContextType | null>(null);

const ADMIN_PASSWORD = 'admin123';
const STORAGE_KEYS = {
  matches: 'bingo_matches',
  players: 'bingo_players',
  playerCards: 'bingo_player_cards',
  matchCards: 'bingo_match_cards',
  currentPlayer: 'bingo_current_player',
  isAdmin: 'bingo_is_admin',
  gameSettings: 'bingo_game_settings',
};

const DEFAULT_SETTINGS: GameSettings = {
  newCardCost: 10,
  cardRechargeCost: 5,
  usesPerRecharge: 1,
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateBingoCard(): number[][] {
  const ranges = [
    [1, 15], [16, 30], [31, 45], [46, 60], [61, 75]
  ];
  const card: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));
  
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const columnNumbers = new Set<number>();
    while (columnNumbers.size < 5) {
      if (col === 2 && columnNumbers.size === 2) {
        columnNumbers.add(0); // Free space
      } else {
        const num = Math.floor(Math.random() * (max - min + 1)) + min;
        columnNumbers.add(num);
      }
    }
    const sortedCol = Array.from(columnNumbers).sort((a, b) => a - b);
    for (let row = 0; row < 5; row++) {
      card[row][col] = sortedCol[row];
    }
  }
  return card;
}

function serializeMatchCards(cards: MatchCard[]): string {
  return JSON.stringify(cards.map(c => ({
    ...c,
    markedNumbers: Array.from(c.markedNumbers),
  })));
}

function deserializeMatchCards(json: string): MatchCard[] {
  const arr = JSON.parse(json);
  return arr.map((c: any) => ({
    ...c,
    markedNumbers: new Set(c.markedNumbers),
  }));
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [matches, setMatches] = useState<Match[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.matches) || '[]'));
  const [players, setPlayers] = useState<Player[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.players) || '[]'));
  const [playerCards, setPlayerCards] = useState<PlayerCard[]>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.playerCards) || '[]'));
  const [matchCards, setMatchCards] = useState<MatchCard[]>(() => deserializeMatchCards(localStorage.getItem(STORAGE_KEYS.matchCards) || '[]'));
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(() => JSON.parse(localStorage.getItem(STORAGE_KEYS.currentPlayer) || 'null'));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.isAdmin) === 'true');
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.gameSettings);
    return stored ? JSON.parse(stored) : DEFAULT_SETTINGS;
  });

  useEffect(() => { localStorage.setItem(STORAGE_KEYS.matches, JSON.stringify(matches)); }, [matches]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.players, JSON.stringify(players)); }, [players]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.playerCards, JSON.stringify(playerCards)); }, [playerCards]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.matchCards, serializeMatchCards(matchCards)); }, [matchCards]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.isAdmin, String(isAdmin)); }, [isAdmin]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.gameSettings, JSON.stringify(gameSettings)); }, [gameSettings]);
  useEffect(() => {
    if (currentPlayer) localStorage.setItem(STORAGE_KEYS.currentPlayer, JSON.stringify(currentPlayer));
    else localStorage.removeItem(STORAGE_KEYS.currentPlayer);
  }, [currentPlayer]);

  useEffect(() => {
    if (currentPlayer) {
      const updated = players.find(p => p.id === currentPlayer.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(currentPlayer)) {
        setCurrentPlayer(updated);
      }
    }
  }, [players, currentPlayer]);

  const adminLogin = useCallback((password: string) => { if (password === ADMIN_PASSWORD) { setIsAdmin(true); return true; } return false; }, []);
  const adminLogout = useCallback(() => setIsAdmin(false), []);
  const updateGameSettings = useCallback((settings: GameSettings) => setGameSettings(settings), []);

  const createMatch = useCallback((data: Omit<Match, 'id' | 'status' | 'playerIds' | 'calledNumbers' | 'pot' | 'createdAt'>): Match => {
    const match: Match = { ...data, id: generateId(), status: 'waiting', playerIds: [], calledNumbers: [], pot: 0, createdAt: new Date().toISOString() };
    setMatches(prev => [...prev, match]);
    return match;
  }, []);

  const openMatch = useCallback((matchId: string) => setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'open' as MatchStatus } : m)), []);
  const startMatch = useCallback((matchId: string) => setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'in_progress' as MatchStatus } : m)), []);
  const finishMatch = useCallback((matchId: string) => setMatches(prev => prev.map(m => m.id === matchId ? { ...m, status: 'finished' as MatchStatus } : m)), []);
  
  const callNumber = useCallback((matchId: string, num: number) => {
    setMatches(prev => prev.map(m => m.id === matchId && !m.calledNumbers.includes(num) ? { ...m, calledNumbers: [...m.calledNumbers, num] } : m));
    setMatchCards(prev => prev.map(card => {
      if (card.matchId !== matchId) return card;
      const newMarked = new Set(card.markedNumbers);
      if (card.numbers.flat().includes(num)) newMarked.add(num);
      return { ...card, markedNumbers: newMarked };
    }));
  }, []);

  const deleteMatch = useCallback((matchId: string) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    setMatchCards(prev => prev.filter(c => c.matchId !== matchId));
  }, []);

  const registerPlayer = useCallback((name: string) => {
    const existing = players.find(p => p.name.toLowerCase() === name.toLowerCase());
    if (existing) { setCurrentPlayer(existing); return; }
    const player: Player = { id: generateId(), name, credits: 100, ownedCardIds: [] };
    setPlayers(prev => [...prev, player]);
    setCurrentPlayer(player);
  }, [players]);

  const logoutPlayer = useCallback(() => setCurrentPlayer(null), []);
  const buyCredits = useCallback((amount: number) => {
    if (!currentPlayer) return;
    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits + amount } : p));
  }, [currentPlayer]);

  const createPlayerCard = useCallback((options: { name: string, numbers: number[][] }): PlayerCard | null => {
    if (!currentPlayer) return null;
    if (currentPlayer.credits < gameSettings.newCardCost) return null;

    const newCard: PlayerCard = { id: generateCardId(), playerId: currentPlayer.id, name: options.name, numbers: options.numbers, usesLeft: 1 };
    
    setPlayerCards(prev => [...prev, newCard]);
    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits - gameSettings.newCardCost, ownedCardIds: [...p.ownedCardIds, newCard.id] } : p));
    return newCard;
  }, [currentPlayer, gameSettings.newCardCost]);

  const joinMatch = useCallback((matchId: string, playerCardIds: string[]): MatchCard[] => {
    if (!currentPlayer || playerCardIds.length === 0) return [];
    const match = matches.find(m => m.id === matchId);
    if (!match || (match.status !== 'open' && match.status !== 'waiting')) return [];

    const cardsToUse = playerCards.filter(pc => playerCardIds.includes(pc.id));
    const allCardsAreValid = cardsToUse.every(c => c.usesLeft > 0 && c.playerId === currentPlayer.id);
    if (cardsToUse.length !== playerCardIds.length || !allCardsAreValid) {
      console.error("Algumas cartelas selecionadas são inválidas ou não tem usos restantes.");
      return [];
    }

    const totalCost = playerCardIds.length * match.cardPrice;
    if (currentPlayer.credits < totalCost) return [];

    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits - totalCost } : p));
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, pot: m.pot + totalCost, playerIds: m.playerIds.includes(currentPlayer.id) ? m.playerIds : [...m.playerIds, currentPlayer.id] } : m));
    
    setPlayerCards(prev => prev.map(pc => {
      if (playerCardIds.includes(pc.id)) {
        return { ...pc, usesLeft: pc.usesLeft - 1 };
      }
      return pc;
    }));

    const newMatchCards: MatchCard[] = cardsToUse.map(playerCard => {
      return {
        id: generateId(),
        playerCardId: playerCard.id,
        playerId: currentPlayer.id,
        matchId,
        name: playerCard.name,
        numbers: playerCard.numbers,
        markedNumbers: new Set([0]),
      };
    });

    setMatchCards(prev => [...prev, ...newMatchCards]);
    return newMatchCards;
  }, [currentPlayer, matches, playerCards]);

  const buyCardUses = useCallback((playerCardId: string): boolean => {
    if (!currentPlayer) return false;
    if (currentPlayer.credits < gameSettings.cardRechargeCost) return false;

    setPlayers(prev => prev.map(p => p.id === currentPlayer.id ? { ...p, credits: p.credits - gameSettings.cardRechargeCost } : p));
    setPlayerCards(prev => prev.map(pc => pc.id === playerCardId ? { ...pc, usesLeft: pc.usesLeft + gameSettings.usesPerRecharge } : pc));
    
    return true;
  }, [currentPlayer, gameSettings]);

  const getMatchCards = useCallback((matchId: string) => matchCards.filter(c => c.matchId === matchId), [matchCards]);
  const getPlayerMatchCards = useCallback((matchId: string, playerId: string) => matchCards.filter(c => c.matchId === matchId && c.playerId === playerId), [matchCards]);

  return (
    <GameContext.Provider value={{
      isAdmin, adminLogin, adminLogout, createMatch, openMatch, startMatch, callNumber, finishMatch, deleteMatch, updateGameSettings,
      currentPlayer, registerPlayer, logoutPlayer, buyCredits, createPlayerCard, joinMatch, buyCardUses,
      matches, players, playerCards, matchCards, gameSettings, getMatchCards, getPlayerMatchCards,
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