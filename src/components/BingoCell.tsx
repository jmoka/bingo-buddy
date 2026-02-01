import { cn } from '@/lib/utils';

interface BingoCellProps {
  number: number;
  isMarked: boolean;
  isFreeSpace: boolean;
  onClick?: () => void;
}

export const BingoCell = ({ number, isMarked, isFreeSpace, onClick }: BingoCellProps) => {
  return (
    <button
      onClick={onClick}
      disabled={isFreeSpace}
      className={cn(
        'bingo-cell',
        isMarked && 'marked animate-pop',
        isFreeSpace && 'free'
      )}
    >
      {isFreeSpace ? '★' : number}
    </button>
  );
};
