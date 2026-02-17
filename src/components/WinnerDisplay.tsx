import { Match } from '@/types/match';
import { MatchCard } from '@/types/match';
import { Trophy } from 'lucide-react';
import { BingoCell } from './BingoCell';
import { gameTypeLabels } from '@/utils/bingoUtils';

interface WinnerDisplayProps {
  match: Match;
  allMatchCards: MatchCard[];
}

export const WinnerDisplay = ({ match, allMatchCards }: WinnerDisplayProps) => {
  if (match.status !== 'finished' || match.winners.length === 0) {
    return null;
  }

  return (
    <div className="card-container text-center mb-6 bg-success/10 border-2 border-success animate-slide-up">
      <Trophy className="w-12 h-12 text-success mx-auto mb-2" />
      <h3 className="font-heading text-2xl font-bold text-success">BINGO!</h3>
      <p className="text-muted-foreground mt-1">A partida foi finalizada. Parabéns ao(s) vencedor(es)!</p>
      
      <div className="mt-6 space-y-6">
        {match.winners.map((winner) => {
          const card = allMatchCards.find(c => c.id === winner.cardId);
          return (
            <div key={winner.cardId}>
              <p className="font-heading text-xl font-bold text-foreground">
                {winner.playerName}
              </p>
              <p className="text-sm text-muted-foreground mb-3">
                com a cartela "{winner.cardName}" ({gameTypeLabels[match.game_type]})
              </p>
              {card && (
                <div className="max-w-xs mx-auto">
                  <div className="grid grid-cols-5 gap-1.5">
                    {['B', 'I', 'N', 'G', 'O'].map(letter => (
                      <div key={letter} className="w-full aspect-square rounded-md flex items-center justify-center text-xs font-heading font-bold gradient-primary text-primary-foreground">
                        {letter}
                      </div>
                    ))}
                    {card.numbers.flat().map((num, i) => (
                      <BingoCell
                        key={`${card.id}-${i}`}
                        number={num}
                        isMarked={card.marked_numbers.has(num)}
                        isFreeSpace={i === 12}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};