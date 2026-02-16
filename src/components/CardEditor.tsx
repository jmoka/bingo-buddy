import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { generateBingoCard, BINGO_RANGES, validateCardGrid } from '@/utils/bingoUtils';
import { AlertCircle, Dices } from 'lucide-react';

interface CardEditorProps {
  initialNumbers?: number[][];
  onNumbersChange: (numbers: number[][], isValid: boolean) => void;
}

export const CardEditor = ({ initialNumbers, onNumbersChange }: CardEditorProps) => {
  const [grid, setGrid] = useState<number[][]>(initialNumbers || generateBingoCard());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validationError = validateCardGrid(grid);
    setError(validationError);
    onNumbersChange(grid, !validationError);
  }, [grid, onNumbersChange]);

  const handleNumberChange = (row: number, col: number, value: string) => {
    const newGrid = grid.map(r => [...r]);
    newGrid[row][col] = parseInt(value, 10) || 0;
    setGrid(newGrid);
  };

  const handleRandomize = () => {
    setGrid(generateBingoCard());
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-1.5">
        {BINGO_RANGES.map(({ col }) => (
          <div key={col} className="text-center font-heading font-bold text-foreground">{col}</div>
        ))}
        {grid.map((row, rowIndex) =>
          row.map((num, colIndex) => (
            <Input
              key={`${rowIndex}-${colIndex}`}
              type="number"
              value={num === 0 ? '' : num}
              onChange={(e) => handleNumberChange(rowIndex, colIndex, e.target.value)}
              disabled={rowIndex === 2 && colIndex === 2}
              className="aspect-square text-center p-0 bg-secondary border-0 font-bold"
              placeholder={rowIndex === 2 && colIndex === 2 ? 'FREE' : ''}
            />
          ))
        )}
      </div>
      
      {error && (
        <div className="flex items-start gap-2 p-2 bg-destructive/10 rounded-lg text-destructive text-sm">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="button" variant="outline" className="w-full" onClick={handleRandomize}>
        <Dices className="w-4 h-4 mr-2" />
        Gerar Números Aleatórios
      </Button>
    </div>
  );
};