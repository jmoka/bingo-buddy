import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Volume2, RotateCcw } from 'lucide-react';

interface NumberCallerProps {
  calledNumbers: Set<number>;
  onCallNumber: (num: number) => void;
  onReset: () => void;
}

export const NumberCaller = ({ calledNumbers, onCallNumber, onReset }: NumberCallerProps) => {
  const [inputNumber, setInputNumber] = useState('');
  const lastCalled = Array.from(calledNumbers).slice(-1)[0];

  const handleCallNumber = () => {
    const num = parseInt(inputNumber, 10);
    if (num >= 1 && num <= 75 && !calledNumbers.has(num)) {
      onCallNumber(num);
      setInputNumber('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCallNumber();
    }
  };

  return (
    <div className="card-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-lg text-foreground">
          Sorteio
        </h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="text-muted-foreground hover:text-destructive"
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reiniciar
        </Button>
      </div>

      {/* Current number display */}
      <div className="flex justify-center mb-6">
        {lastCalled ? (
          <div className="bingo-ball animate-bounce-in text-2xl" key={lastCalled}>
            {lastCalled}
          </div>
        ) : (
          <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
            <Volume2 className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Number input */}
      <div className="flex gap-2 mb-4">
        <Input
          type="number"
          min={1}
          max={75}
          placeholder="Número (1-75)"
          value={inputNumber}
          onChange={(e) => setInputNumber(e.target.value)}
          onKeyDown={handleKeyDown}
          className="bg-secondary border-0 text-center text-lg font-semibold"
        />
        <Button 
          onClick={handleCallNumber}
          className="gradient-accent shadow-button px-6"
          disabled={!inputNumber}
        >
          Marcar
        </Button>
      </div>

      {/* Called numbers history */}
      <div className="mt-4">
        <p className="text-sm text-muted-foreground mb-2">
          Números sorteados ({calledNumbers.size})
        </p>
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {Array.from(calledNumbers).map((num) => (
            <span
              key={num}
              className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center"
            >
              {num}
            </span>
          ))}
          {calledNumbers.size === 0 && (
            <span className="text-sm text-muted-foreground italic">
              Nenhum número sorteado
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
