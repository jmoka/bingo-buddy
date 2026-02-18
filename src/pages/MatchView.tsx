import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BingoCell } from '@/components/BingoCell';
import { Button } from '@/components/ui/button';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { ArrowLeft, Coins, Users, Bot } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/soundUtils';
import { WinnerDisplay } from '@/components/WinnerDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { MatchStats } from '@/components/MatchStats';

const MatchView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { matches, getPlayerMatchCards, matchCards } = useGame();
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const match = matches.find(m => m.id === id);
  const myCards = profile && id ? getPlayerMatchCards(id, profile.id) : [];
  const allCardsForThisMatch = matchCards.filter(c => c.match_id === id);

  const prevCalledNumbersRef = useRef<number[]>(match ? match.called_numbers : []);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!match) return;

    const prevNumbers = prevCalledNumbersRef.current;
    const currentNumbers = match.called_numbers;

    if (currentNumbers.length > prevNumbers.length) {
      const newNumber = currentNumbers[currentNumbers.length - 1];
      setLastCalledNumber(newNumber);
      
      if (match.status !== 'finished') {
        toast.info(`Número sorteado: ${newNumber}!`, {
          description: 'Confira sua cartela.',
        });
        playNotificationSound();
      }
    }
    
    if (match.status === 'finished' && prevCalledNumbersRef.current.length < currentNumbers.length) {
      toast.success('BINGO! Temos um vencedor!', {
        description: `Parabéns a ${match.winners.map(w => w.playerName).join(', ')}!`,
        duration: 10000,
      });
      playNotificationSound();
    }

    prevCalledNumbersRef.current = currentNumbers;
  }, [match]);

  if (!match) {
    return (
      <div className="card-container text-center">
        <p className="text-muted-foreground">Partida não encontrada.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>Voltar</Button>
      </div>
    );
  }

  const playersInMatchCount = new Set(allCardsForThisMatch.map(mc => mc.player_id)).size;
  const lastCalled = match.called_numbers.length > 0 ? match.called_numbers[match.called_numbers.length - 1] : null;
  const countdown = match.next_auto_call_timestamp ? Math.max(0, Math.round((new Date(match.next_auto_call_timestamp).getTime() - now) / 1000)) : null;

  return (
    <>
      <div className="gradient-hero py-4 px-4 -mt-6 sm:-mt-8 -mx-4 mb-6 rounded-b-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-heading text-lg sm:text-xl font-bold text-primary-foreground">{match.name}</h1>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-primary-foreground/70 text-xs">
                <span>{gameTypeLabels[match.game_type]}</span>
                <span className="flex items-center gap-1"><Users className="w-3 h-3" />{playersInMatchCount}</span>
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" />Pote: {match.pot}</span>
              </div>
            </div>
          </div>
          {lastCalled && (
            <div className="bingo-ball animate-bounce-in text-xl w-12 h-12 sm:w-14 sm:h-14" key={lastCalled}>
              {lastCalled}
            </div>
          )}
        </div>
      </div>

      <WinnerDisplay match={match} allMatchCards={allCardsForThisMatch} />

      {match.status !== 'finished' && (
        <MatchStats match={match} allMatchCards={allCardsForThisMatch} />
      )}

      {match.status !== 'finished' && match.is_auto_calling && (
        <div className="card-container mb-6 bg-accent/10 text-accent text-center p-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <p className="font-medium text-sm flex items-center gap-2">
              <Bot className="w-4 h-4" />
              Sorteio automático ativado!
            </p>
            {countdown !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm">Próximo número em:</span>
                <span className="font-bold font-mono text-lg bg-accent text-accent-foreground rounded-md px-2 py-1">
                  {countdown}s
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card-container mb-6">
        <p className="text-sm text-muted-foreground mb-2">Números sorteados ({(match.called_numbers || []).length})</p>
        <div className="flex flex-wrap gap-1.5">
          {(match.called_numbers || []).map(num => (
            <span key={num} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
              {num}
            </span>
          ))}
          {(match.called_numbers || []).length === 0 && (
            <span className="text-sm text-muted-foreground italic">Aguardando sorteio...</span>
          )}
        </div>
      </div>

      <h2 className="font-heading text-lg font-bold text-foreground mb-4">
        Minhas Cartelas ({myCards.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {myCards.map((card) => (
          <div key={card.id} className="card-container">
            <h3 className="font-heading font-semibold text-foreground mb-3">{card.name}</h3>
            <div className="grid grid-cols-5 gap-1.5">
              {['B', 'I', 'N', 'G', 'O'].map(letter => (
                <div key={letter} className="w-full aspect-square rounded-md flex items-center justify-center text-sm font-heading font-bold gradient-primary text-primary-foreground">
                  {letter}
                </div>
              ))}
              {card.numbers.flat().map((num, i) => (
                  <BingoCell
                    key={`${card.id}-${i}`}
                    number={num}
                    isMarked={card.marked_numbers.has(num)}
                    isFreeSpace={i === 12}
                    isNewlyMarked={num === lastCalledNumber}
                  />
                ))
              }
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default MatchView;