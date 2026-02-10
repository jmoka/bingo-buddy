import { useState, useCallback, useEffect } from 'react';
import { BingoCard, GameType, WinResult } from '@/types/bingo';
import { checkWin } from '@/utils/bingoUtils';

export const useBingoGame = () => {
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [calledNumbers, setCalledNumbers] = useState<Set<number>>(new Set());
  const [gameType, setGameType] = useState<GameType>('full');
  const [winners, setWinners] = useState<WinResult[]>([]);
  const [winnerIds, setWinnerIds] = useState<Set<string>>(new Set());

  const addCard = useCallback((card: BingoCard) => {
    setCards((prev) => [...prev, card]);
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((card) => card.id !== id));
    setWinnerIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const callNumber = useCallback((num: number) => {
    setCalledNumbers((prev) => {
      const next = new Set(prev);
      next.add(num);
      return next;
    });
  }, []);

  const resetGame = useCallback(() => {
    setCalledNumbers(new Set());
    setCards((prev) =>
      prev.map((card) => ({
        ...card,
        markedNumbers: new Set(),
      }))
    );
    setWinners([]);
    setWinnerIds(new Set());
  }, []);

  const clearWinners = useCallback(() => {
    setWinners([]);
  }, []);

  // Mark numbers on cards when a number is called
  // 0 (FREE space) is always considered marked
  useEffect(() => {
    setCards((prev) =>
      prev.map((card) => ({
        ...card,
        markedNumbers: new Set(
          card.numbers.flat().filter((num) => num === 0 || calledNumbers.has(num))
        ),
      }))
    );
  }, [calledNumbers]);

  // Check for winners when cards are updated
  useEffect(() => {
    const newWinners: WinResult[] = [];

    cards.forEach((card) => {
      if (winnerIds.has(card.id)) return; // Already a winner

      const result = checkWin(card, gameType);
      if (result) {
        newWinners.push(result);
      }
    });

    if (newWinners.length > 0) {
      setWinners(newWinners);
      setWinnerIds((prev) => {
        const next = new Set(prev);
        newWinners.forEach((w) => next.add(w.cardId));
        return next;
      });
    }
  }, [cards, gameType, winnerIds]);

  return {
    cards,
    calledNumbers,
    gameType,
    winners,
    winnerIds,
    addCard,
    removeCard,
    callNumber,
    resetGame,
    setGameType,
    clearWinners,
  };
};
