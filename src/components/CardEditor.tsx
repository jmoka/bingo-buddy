import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { BINGO_RANGES, validateCardGrid } from '@/utils/bingoUtils';
import { generateBingoCard } from '@/contexts/GameContext';
import { AlertCircle, Dices } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CardEditorProps {
  onCardChange: (numbers: number[][] | null) => void;
}

export const CardEditor = ({ onCardChange }: CardEditorProps) => {
  const [grid, setGrid] = useState<number[][]>(generateBingoCard());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validationError = validateCardGrid(grid);
    setError(validationError);
    if (validationError) {
      onCardChange(null); // Card is invalid
    } else {
      onCardChange(grid); // Card is valid
    }
  }, [grid, onCardChange]);

  const handleNumberChange = (row: number, col: number, value: string) => {
    const newGrid = grid.map(r => [...r]);
    const numValue = parseInt(value, 10);
    // Allow empty inputs, treat them as 0 for validation
    newGrid[row][col] = isNaN(numValue) ? 0 : numValue;
    setGrid(newGrid);
  };

  const handleRandomize = () => {
    setGrid(generateBingoCard());
  };

  return (
    <div className="space-y-4">
      {/* B-I-N-G-O Header */}
      <div className="grid grid-cols-5 gap-2 text-center font-heading font-bold text-foreground">
        {BINGO_RANGES.map(({ col }) => <div key={col}>{col}</div>)}
      </div>

      {/* Grid Inputs */}
      <div className="grid grid-cols-5 gap-2">
        {grid.map((row, rowIndex) =>
          row.map((num, colIndex) => {
            const isFreeSpace = rowIndex === 2 && colIndex === 2;
            return (
              <Input
                key={`${rowIndex}-${colIndex}`}
                type="number"
                value={isFreeSpace || num === 0 ? '' : num}
                onChange={(e) => handleNumberChange(rowIndex, colIndex, e.target.value)}
                disabled={isFreeSpace}
                className={cn(
                  "aspect-square h-auto text-center p-0 text-base font-bold rounded-lg",
                  isFreeSpace ? "bg-primary/20 text-primary" : "bg-secondary border-0"
                )}
                placeholder={isFreeSpace ? '★' : ''}
              />
            );
          })
        )}
      </div>
      
      {/* Validation Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg text-destructive text-sm animate-slide-up">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Randomize Button */}
      <Button type="button" variant="outline" className="w-full" onClick={handleRandomize}>
        <Dices className="w-4 h-4 mr-2" />
        Gerar Números Aleatórios
      </Button>
    </div>
  );
};