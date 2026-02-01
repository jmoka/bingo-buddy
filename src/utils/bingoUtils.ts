import { BingoCard, GameType, WinResult } from '@/types/bingo';

export const generateCardId = (): string => {
  return `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const checkHorizontalWin = (card: BingoCard): number[] | null => {
  for (let row = 0; row < 5; row++) {
    const rowNumbers = card.numbers[row];
    const allMarked = rowNumbers.every((num, col) => 
      (row === 2 && col === 2) || card.markedNumbers.has(num)
    );
    if (allMarked) {
      return rowNumbers;
    }
  }
  return null;
};

export const checkVerticalWin = (card: BingoCard): number[] | null => {
  for (let col = 0; col < 5; col++) {
    const colNumbers = card.numbers.map(row => row[col]);
    const allMarked = colNumbers.every((num, row) => 
      (row === 2 && col === 2) || card.markedNumbers.has(num)
    );
    if (allMarked) {
      return colNumbers;
    }
  }
  return null;
};

export const checkDiagonalWin = (card: BingoCard): number[] | null => {
  // Main diagonal (top-left to bottom-right)
  const mainDiag = [0, 1, 2, 3, 4].map(i => card.numbers[i][i]);
  const mainDiagWin = mainDiag.every((num, i) => 
    (i === 2) || card.markedNumbers.has(num)
  );
  if (mainDiagWin) return mainDiag;

  // Anti-diagonal (top-right to bottom-left)
  const antiDiag = [0, 1, 2, 3, 4].map(i => card.numbers[i][4 - i]);
  const antiDiagWin = antiDiag.every((num, i) => 
    (i === 2) || card.markedNumbers.has(num)
  );
  if (antiDiagWin) return antiDiag;

  return null;
};

export const checkFullCardWin = (card: BingoCard): number[] | null => {
  const allNumbers: number[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) continue; // Free space
      const num = card.numbers[row][col];
      if (!card.markedNumbers.has(num)) {
        return null;
      }
      allNumbers.push(num);
    }
  }
  return allNumbers;
};

export const checkWin = (card: BingoCard, gameType: GameType): WinResult | null => {
  let winningNumbers: number[] | null = null;

  switch (gameType) {
    case 'horizontal':
      winningNumbers = checkHorizontalWin(card);
      break;
    case 'vertical':
      winningNumbers = checkVerticalWin(card);
      break;
    case 'diagonal':
      winningNumbers = checkDiagonalWin(card);
      break;
    case 'full':
      winningNumbers = checkFullCardWin(card);
      break;
  }

  if (winningNumbers) {
    return {
      cardId: card.id,
      cardName: card.name,
      type: gameType,
      winningNumbers,
    };
  }

  return null;
};

export const parseCardNumbers = (input: string): number[][] | null => {
  const lines = input.trim().split('\n');
  if (lines.length !== 5) return null;

  const grid: number[][] = [];
  for (const line of lines) {
    const numbers = line.split(/[\s,]+/).map(n => parseInt(n.trim(), 10));
    if (numbers.length !== 5 || numbers.some(isNaN)) return null;
    grid.push(numbers);
  }

  return grid;
};

export const gameTypeLabels: Record<GameType, string> = {
  full: 'Cartela Cheia',
  horizontal: 'Linha Horizontal',
  vertical: 'Linha Vertical',
  diagonal: 'Diagonal',
};
