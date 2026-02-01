import { Header } from '@/components/Header';
import { AddCardForm } from '@/components/AddCardForm';
import { BingoCardDisplay } from '@/components/BingoCardDisplay';
import { NumberCaller } from '@/components/NumberCaller';
import { GameTypeSelector } from '@/components/GameTypeSelector';
import { WinnerAnnouncement } from '@/components/WinnerAnnouncement';
import { useBingoGame } from '@/hooks/useBingoGame';

const Index = () => {
  const {
    cards,
    calledNumbers,
    gameType,
    winners,
    winnerIds,
    addCard,
    removeCard,
    callNumber,
    resetGame,
    setGameType,
    clearWinners,
  } = useBingoGame();

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container max-w-6xl mx-auto py-8 px-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Controls */}
          <div className="space-y-6">
            <NumberCaller
              calledNumbers={calledNumbers}
              onCallNumber={callNumber}
              onReset={resetGame}
            />
            <GameTypeSelector
              selected={gameType}
              onChange={setGameType}
            />
            <AddCardForm onAddCard={addCard} />
          </div>

          {/* Right column - Cards */}
          <div className="lg:col-span-2">
            <h2 className="font-heading font-bold text-2xl text-foreground mb-4">
              Cartelas ({cards.length})
            </h2>
            
            {cards.length === 0 ? (
              <div className="card-container text-center py-12">
                <p className="text-muted-foreground">
                  Nenhuma cartela cadastrada.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Adicione cartelas usando o formulário ao lado.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((card) => (
                  <BingoCardDisplay
                    key={card.id}
                    card={card}
                    isWinner={winnerIds.has(card.id)}
                    onRemove={removeCard}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <WinnerAnnouncement winners={winners} onClose={clearWinners} />
    </div>
  );
};

export default Index;
