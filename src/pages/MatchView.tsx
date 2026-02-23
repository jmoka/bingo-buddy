import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BingoCell } from '@/components/BingoCell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { ArrowLeft, Coins, Users, Bot, Loader2, Star, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { playNotificationSound } from '@/utils/soundUtils';
import { WinnerDisplay } from '@/components/WinnerDisplay';
import { useAuth } from '@/contexts/AuthContext';
import { MatchStats } from '@/components/MatchStats';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const MatchView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { matches, getPlayerMatchCards, matchCards, isLoading } = useGame();
  const [lastCalledNumber, setLastCalledNumber] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const match = matches.find(m => m.id === id);
  const myCards = profile && id ? getPlayerMatchCards(id, profile.id) : [];
  const allCardsForThisMatch = matchCards.filter(c => c.match_id === id);

  const prevCalledNumbersRef = useRef<number[]>(match ? match.called_numbers : []);
  const prevWinnersCountRef = useRef<number>(match ? match.winners.length : 0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!match) return;

    // Notificação de novo número
    const currentNumbers = match.called_numbers;
    if (currentNumbers.length > prevCalledNumbersRef.current.length) {
      const newNumber = currentNumbers[currentNumbers.length - 1];
      setLastCalledNumber(newNumber);
      if (match.status !== 'finished') {
        toast.info(`Número sorteado: ${newNumber}!`, { duration: 2000 });
        playNotificationSound();
      }
    }
    prevCalledNumbersRef.current = currentNumbers;

    // Notificação de vencedor (especialmente para modo brincar com jogo em andamento)
    if (match.winners.length > prevWinnersCountRef.current) {
      const latestWinner = match.winners[match.winners.length - 1];
      const isFunWinner = (latestWinner as any).creditType === 'fake';

      if (isFunWinner && match.status !== 'finished') {
        toast.success(`BINGO DE BRINCAR!`, {
          description: `${latestWinner.playerName} bateu com a cartela "${latestWinner.cardName}". O jogo continua para o prêmio real!`,
          duration: 6000,
        });
        playNotificationSound();
      } else if (match.status === 'finished') {
        toast.success('BINGO! Partida finalizada!', {
          description: `Parabéns aos vencedores!`,
          duration: 10000,
        });
        playNotificationSound();
      }
    }
    prevWinnersCountRef.current = match.winners.length;

  }, [match]);

  if (isLoading && !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-heading">Carregando partida...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="card-container text-center py-20">
        <p className="text-muted-foreground text-lg">Partida não encontrada.</p>
        <Button className="mt-6 gradient-primary" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Lobby
        </Button>
      </div>
    );
  }

  const playersInMatchCount = new Set(allCardsForThisMatch.map(mc => mc.player_id)).size;
  const lastCalled = match.called_numbers.length > 0 ? match.called_numbers[match.called_numbers.length - 1] : null;
  const countdown = match.next_auto_call_timestamp ? Math.max(0, Math.round((new Date(match.next_auto_call_timestamp).getTime() - now) / 1000)) : null;

  // Filtra vencedores de brincar que ganharam enquanto o jogo ainda corre
  const funWinnersInProgress = match.winners.filter(w => (w as any).creditType === 'fake');

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
                <span className="flex items-center gap-1"><Coins className="w-3 h-3" />Pote: {Number(match.pot || 0).toFixed(2)}</span>
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

      {/* Alerta de Vencedores de Brincar (Jogo em andamento) */}
      {match.status === 'in_progress' && funWinnersInProgress.length > 0 && (
        <Alert className="mb-6 border-amber-500 bg-amber-500/10 text-amber-700 animate-pulse">
          <Star className="h-4 w-4 text-amber-600" />
          <AlertTitle className="font-heading font-bold">Bingo de Brincar!</AlertTitle>
          <AlertDescription className="text-xs">
            {funWinnersInProgress.map(w => w.playerName).join(', ')} já bateu Bingo de brincar. 
            <strong> O jogo continua valendo o prêmio real!</strong>
          </AlertDescription>
        </Alert>
      )}

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
        </div>
      </div>

      <h2 className="font-heading text-lg font-bold text-foreground mb-4">
        Minhas Cartelas ({myCards.length})
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {myCards.map((card) => (
          <div key={card.id} className="card-container max-w-sm mx-auto w-full">
            <h3 className="font-heading font-semibold text-foreground mb-4 flex items-center justify-between">
              {card.name}
              {(card as any).credit_type === 'fake' && <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-600">Brincar</Badge>}
            </h3>
            <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
              {['B', 'I', 'N', 'G', 'O'].map(letter => (
                <div key={letter} className="w-full aspect-square rounded-lg flex items-center justify-center text-sm sm:text-lg font-heading font-bold gradient-primary text-primary-foreground shadow-sm">
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