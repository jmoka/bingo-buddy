import { Match, MatchCard } from '@/types/match';
import { calculateNumbersToWin } from '@/utils/bingoUtils';
import { Ticket, Trophy, Flame, Target } from 'lucide-react';

interface MatchStatsProps {
  match: Match;
  allMatchCards: MatchCard[];
}

const getPrizeDisplay = (match: Match) => {
  if (match.prize.type === 'product') return `🎁 ${match.prize.productName || 'Produto'}`;
  if (match.prize.type === 'fixed') return `💰 ${match.prize.value} créditos`;
  if (match.prize.type === 'percentage') return `📊 ${match.prize.value}% do pote (${Math.floor(match.pot * (match.prize.value || 0) / 100)} créditos)`;
  return 'Prêmio não definido';
};

export const MatchStats = ({ match, allMatchCards }: MatchStatsProps) => {
  const totalCards = allMatchCards.length;
  const prizeDisplay = getPrizeDisplay(match);

  const stats = {
    missing5: 0,
    missing3: 0,
    missing1: 0,
  };

  if (match.status === 'in_progress') {
    for (const card of allMatchCards) {
      const needed = calculateNumbersToWin(card, match.game_type);
      if (needed === 1) stats.missing1++;
      if (needed === 3) stats.missing3++;
      if (needed === 5) stats.missing5++;
    }
  }

  const hasStatsToShow = stats.missing1 > 0 || stats.missing3 > 0 || stats.missing5 > 0;

  return (
    <div className="card-container mb-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/50">
          <Ticket className="w-6 h-6 text-primary mb-1" />
          <span className="font-bold text-xl font-heading">{totalCards}</span>
          <span className="text-xs text-muted-foreground">Cartelas na Partida</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/50">
          <Trophy className="w-6 h-6 text-success mb-1" />
          <span className="font-bold text-lg font-heading text-center">{prizeDisplay}</span>
          <span className="text-xs text-muted-foreground">Prêmio</span>
        </div>
        <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-muted/50">
          <Flame className="w-6 h-6 text-destructive mb-1" />
          <span className="font-bold text-xl font-heading">Quase lá!</span>
          <span className="text-xs text-muted-foreground">Cartelas perto de ganhar</span>
        </div>
      </div>
      {hasStatsToShow && (
        <div className="mt-4 pt-4 border-t border-border flex justify-center items-center gap-4 flex-wrap">
          {stats.missing5 > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{stats.missing5}</span>
              <span className="text-muted-foreground">cartela(s) faltam 5</span>
            </div>
          )}
          {stats.missing3 > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Target className="w-4 h-4 text-accent" />
              <span className="font-semibold">{stats.missing3}</span>
              <span className="text-muted-foreground">cartela(s) faltam 3</span>
            </div>
          )}
          {stats.missing1 > 0 && (
            <div className="flex items-center gap-2 text-sm text-destructive font-bold">
              <Target className="w-4 h-4" />
              <span>{stats.missing1}</span>
              <span>cartela(s) por 1!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};