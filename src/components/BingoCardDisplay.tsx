import { BingoCard } from '@/types/bingo';
import { BingoCell } from './BingoCell';
import { cn } from '@/lib/utils';
import { Trash2, Trophy } from 'lucide-react';
import { Button } from './ui/button';

interface BingoCardDisplayProps {
  card: BingoCard;
  isWinner: boolean;
  onRemove: (id: string) => void;
}

export const BingoCardDisplay = ({ card, isWinner, onRemove }: BingoCardDisplayProps) => {
  return (
    <div className={cn('card-container animate-slide-up', isWinner && 'winner')}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="font-heading font-semibold text-lg text-foreground">{card.name}</h3>
          {isWinner && (
            <Trophy className="w-5 h-5 text-success animate-bounce-in" />
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(card.id)}
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-5 gap-1.5">
        {/* BINGO header */}
        {['B', 'I', 'N', 'G', 'O'].map((letter) => (
          <div
            key={letter}
            className="w-12 h-8 rounded-md flex items-center justify-center text-sm font-heading font-bold gradient-primary text-primary-foreground"
          >
            {letter}
          </div>
        ))}
        
        {/* Numbers grid */}
        {card.numbers.map((row, rowIndex) =>
          row.map((num, colIndex) => (
            <BingoCell
              key={`${rowIndex}-${colIndex}`}
              number={num}
              isMarked={card.markedNumbers.has(num)}
              isFreeSpace={rowIndex === 2 && colIndex === 2}
            />
          ))
        )}
      </div>
    </div>
  );
};
