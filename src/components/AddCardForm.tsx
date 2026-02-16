import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { parseCardNumbers, generateCardId } from '@/utils/bingoUtils';
import { BingoCard } from '@/types/bingo';
import { Plus, HelpCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from './ui/tooltip';

interface AddCardFormProps {
  onAddCard: (card: BingoCard) => void;
}

export const AddCardForm = ({ onAddCard }: AddCardFormProps) => {
  const [name, setName] = useState('');
  const [numbers, setNumbers] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Digite o nome da cartela');
      return;
    }

    const grid = parseCardNumbers(numbers);
    if (!grid) {
      setError('Formato inválido. Use 5 linhas com 5 números cada.');
      return;
    }

    const card: BingoCard = {
      id: generateCardId(),
      name: name.trim(),
      numbers: grid,
      markedNumbers: new Set(),
    };

    onAddCard(card);
    setName('');
    setNumbers('');
  };

  const exampleFormat = `1 15 30 45 60
5 20 35 50 65
10 25 FREE 55 70
12 28 38 52 72
14 29 44 59 75`;

  return (
    <form onSubmit={handleSubmit} className="card-container">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-heading font-semibold text-lg text-foreground">
          Adicionar Cartela
        </h3>
        <Tooltip>
          <TooltipTrigger asChild>
            <button type="button" className="text-muted-foreground hover:text-foreground">
              <HelpCircle className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">
              Digite 5 linhas com 5 números cada, separados por espaço ou vírgula.
              O centro (FREE) é automático.
            </p>
            <pre className="mt-2 text-xs bg-secondary p-2 rounded">{exampleFormat}</pre>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="space-y-4">
        <div>
          <Input
            placeholder="Nome da cartela (ex: Cartela 1)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary border-0"
          />
        </div>

        <div>
          <Textarea
            placeholder={`Digite os números da cartela:\n${exampleFormat}`}
            value={numbers}
            onChange={(e) => setNumbers(e.target.value)}
            rows={5}
            className="bg-secondary border-0 font-mono text-sm"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive animate-slide-up">{error}</p>
        )}

        <Button type="submit" className="w-full gradient-primary shadow-button">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Cartela
        </Button>
      </div>
    </form>
  );
};
