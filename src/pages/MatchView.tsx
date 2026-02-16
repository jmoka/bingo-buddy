import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { BingoCell } from '@/components/BingoCell';
import { Button } from '@/components/ui/button';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { ArrowLeft, Coins, Trophy, Users } from 'lucide-react';
import { useEffect, useState } from 'react';

const MatchView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { matches, currentPlayer, getPlayerMatchCards } = useGame();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const match = matches.find(m => m.id === id);
  const myCards = currentPlayer && id ? getPlayerMatchCards(id, currentPlayer.id) : [];

  if (!match) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="card-container text-center">
          <p className="text-muted-foreground">Partida não encontrada.</p>
          <Button className="mt-4" onClick={() => navigate('/')}>Voltar</Button>
        </div>
      </div>
    );
  }

  const lastCalled = match.calledNumbers.length > 0 ? match.calledNumbers[match.calledNumbers.length - 1] : null;

  return (
    <div className="min-h-screen bg-background">
      <header className="gradient-hero py-4 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="text-primary-foreground" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-heading text-xl font-bold text-primary-foreground">{match.name}</h1>
                <div className="flex gap-3 text-primary-foreground/70 text-xs">
                  <span>{gameTypeLabels[match.gameType]}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{match.playerIds.length}</span>
                  <span className="flex items-center gap-1"><Coins className="w-3 h-3" />Pote: {match.pot}</span>
                </div>
              </div>
            </div>
            {/* Current ball */}
            {lastCalled && (
              <div className="bingo-ball animate-bounce-in text-xl" key={lastCalled}>
                {lastCalled}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-6 px-4">
        {/* Called numbers */}
        <div className="card-container mb-6">
          <p className="text-sm text-muted-foreground mb-2">Números sorteados ({match.calledNumbers.length})</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {match.calledNumbers.map(num => (
              <span key={num} className="w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-medium flex items-center justify-center">
                {num}
              </span>
            ))}
            {match.calledNumbers.length === 0 && (
              <span className="text-sm text-muted-foreground italic">Aguardando sorteio...</span>
            )}
          </div>
        </div>

        {/* My cards */}
        <h2 className="font-heading text-lg font-bold text-foreground mb-4">
          Minhas Cartelas ({myCards.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {myCards.map((card, idx) => (
            <div key={card.id} className="card-container">
              <h3 className="font-heading font-semibold text-foreground mb-3">Cartela {idx + 1}</h3>
              <div className="grid grid-cols-5 gap-1.5">
                {['B', 'I', 'N', 'G', 'O'].map(letter => (
                  <div key={letter} className="w-12 h-8 rounded-md flex items-center justify-center text-sm font-heading font-bold gradient-primary text-primary-foreground">
                    {letter}
                  </div>
                ))}
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
          ))}
        </div>

        {match.status === 'finished' && (
          <div className="card-container text-center mt-6 bg-success/10 border-2 border-success">
            <Trophy className="w-12 h-12 text-success mx-auto mb-2" />
            <h3 className="font-heading text-xl font-bold text-success">Partida Finalizada!</h3>
          </div>
        )}
      </main>
    </div>
  );
};

export default MatchView;
