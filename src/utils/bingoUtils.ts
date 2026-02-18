import { BingoCard, GameType, WinResult } from '@/types/bingo';
import { MatchCard } from '@/types/match';

export const generateBingoCard = (): number[][] => {
  const grid: number[][] = Array(5).fill(0).map(() => Array(5).fill(0));

  const ranges = [
    { min: 1, max: 15, count: 5 },  // B
    { min: 16, max: 30, count: 5 }, // I
    { min: 31, max: 45, count: 4 }, // N (4 numbers + free space)
    { min: 46, max: 60, count: 5 }, // G
    { min: 61, max: 75, count: 5 }, // O
  ];

  const columns = ranges.map(range => {
    const available = Array.from({ length: range.max - range.min + 1 }, (_, i) => i + range.min);
    const columnNumbers: number[] = [];
    for (let i = 0; i < range.count; i++) {
      const randomIndex = Math.floor(Math.random() * available.length);
      columnNumbers.push(available.splice(randomIndex, 1)[0]);
    }
    return columnNumbers;
  });

  for (let row = 0; row < 5; row++) {
    grid[row][0] = columns[0][row];
    grid[row][1] = columns[1][row];
    if (row < 2) {
      grid[row][2] = columns[2][row];
    } else if (row > 2) {
      grid[row][2] = columns[2][row - 1];
    }
    grid[row][3] = columns[3][row];
    grid[row][4] = columns[4][row];
  }

  grid[2][2] = 0; // Free space

  return grid;
};

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

export const calculateNumbersToWin = (card: MatchCard, gameType: GameType): number => {
  const { numbers, marked_numbers } = card;

  switch (gameType) {
    case 'full': {
      const totalNumbersOnCard = 24; // 25 cells - 1 free space
      return totalNumbersOnCard - marked_numbers.size;
    }

    case 'horizontal': {
      let minNeeded = Infinity;
      for (let r = 0; r < 5; r++) {
        let neededInRow = 0;
        for (let c = 0; c < 5; c++) {
          if (r === 2 && c === 2) continue; // Skip free space
          if (!marked_numbers.has(numbers[r][c])) {
            neededInRow++;
          }
        }
        minNeeded = Math.min(minNeeded, neededInRow);
      }
      return minNeeded;
    }

    case 'vertical': {
      let minNeeded = Infinity;
      for (let c = 0; c < 5; c++) {
        let neededInCol = 0;
        for (let r = 0; r < 5; r++) {
          if (r === 2 && c === 2) continue; // Skip free space
          if (!marked_numbers.has(numbers[r][c])) {
            neededInCol++;
          }
        }
        minNeeded = Math.min(minNeeded, neededInCol);
      }
      return minNeeded;
    }

    case 'diagonal': {
      let neededMain = 0;
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue; // Skip free space
        if (!marked_numbers.has(numbers[i][i])) {
          neededMain++;
        }
      }

      let neededAnti = 0;
      for (let i = 0; i < 5; i++) {
        if (i === 2) continue; // Skip free space
        if (!marked_numbers.has(numbers[i][4 - i])) {
          neededAnti++;
        }
      }
      return Math.min(neededMain, neededAnti);
    }

    default:
      return Infinity;
  }
};


export const parseCardNumbers = (input: string): number[][] | null => {
  const lines = input.trim().split('\n');
  if (lines.length !== 5) return null;

  const grid: number[][] = [];
  for (let rowIndex = 0; rowIndex < lines.length; rowIndex++) {
    const line = lines[rowIndex];
    const parts = line.split(/[\s,]+/);
    if (parts.length !== 5) return null;
    
    const numbers: number[] = [];
    for (let colIndex = 0; colIndex < parts.length; colIndex++) {
      const part = parts[colIndex].trim().toUpperCase();
      
      // Center cell (row 2, col 2) can be FREE or any number
      if (rowIndex === 2 && colIndex === 2 && (part === 'FREE' || part === 'LIVRE' || part === '*')) {
        numbers.push(0); // Use 0 as placeholder for FREE space
      } else {
        const num = parseInt(part, 10);
        if (isNaN(num)) return null;
        numbers.push(num);
      }
    }
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

export const BINGO_RANGES = [
  { col: 'B', min: 1, max: 15 },
  { col: 'I', min: 16, max: 30 },
  { col: 'N', min: 31, max: 45 },
  { col: 'G', min: 46, max: 60 },
  { col: 'O', min: 61, max: 75 },
];

export const validateCardGrid = (grid: number[][]): string | null => {
  if (grid.length !== 5 || grid.some(row => row.length !== 5)) {
    return "A grade deve ser 5x5.";
  }

  const allNumbers = new Set<number>();

  for (let col = 0; col < 5; col++) {
    const colNumbers = new Set<number>();
    const range = BINGO_RANGES[col];

    for (let row = 0; row < 5; row++) {
      if (row === 2 && col === 2) {
        if (grid[row][col] !== 0) return "O centro deve ser um espaço livre (0).";
        continue;
      }

      const num = grid[row][col];
      if (isNaN(num) || num < range.min || num > range.max) {
        return `Número na coluna ${range.col} está fora do intervalo (${range.min}-${range.max}).`;
      }
      if (colNumbers.has(num)) {
        return `Número duplicado ${num} na coluna ${range.col}.`;
      }
      if (allNumbers.has(num) && num !== 0) {
        return `Número duplicado ${num} na cartela.`;
      }
      colNumbers.add(num);
      allNumbers.add(num);
    }
  }

  return null;
};