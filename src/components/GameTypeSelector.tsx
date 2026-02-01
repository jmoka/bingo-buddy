import { GameType } from '@/types/bingo';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { cn } from '@/lib/utils';
import { Grid3X3, Minus, StretchHorizontal, StretchVertical } from 'lucide-react';

interface GameTypeSelectorProps {
  selected: GameType;
  onChange: (type: GameType) => void;
}

const icons: Record<GameType, React.ReactNode> = {
  full: <Grid3X3 className="w-5 h-5" />,
  horizontal: <StretchHorizontal className="w-5 h-5" />,
  vertical: <StretchVertical className="w-5 h-5" />,
  diagonal: <Minus className="w-5 h-5 rotate-45" />,
};

export const GameTypeSelector = ({ selected, onChange }: GameTypeSelectorProps) => {
  const types: GameType[] = ['full', 'horizontal', 'vertical', 'diagonal'];

  return (
    <div className="card-container">
      <h3 className="font-heading font-semibold text-lg text-foreground mb-4">
        Tipo de Jogo
      </h3>
      
      <div className="grid grid-cols-2 gap-2">
        {types.map((type) => (
          <button
            key={type}
            onClick={() => onChange(type)}
            className={cn(
              'flex items-center gap-2 p-3 rounded-xl transition-all duration-200',
              selected === type
                ? 'gradient-primary text-primary-foreground shadow-button'
                : 'bg-secondary text-foreground hover:bg-muted'
            )}
          >
            {icons[type]}
            <span className="text-sm font-medium">{gameTypeLabels[type]}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
