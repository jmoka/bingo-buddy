import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { PrintableBingoCard } from '@/components/PrintableBingoCard';
import { ArrowLeft, Printer } from 'lucide-react';

const PrintView = () => {
  const navigate = useNavigate();
  const { currentPlayer, playerCards } = useGame();

  if (!currentPlayer) {
    navigate('/');
    return null;
  }

  const myOwnedCards = playerCards.filter(c => c.playerId === currentPlayer.id);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print-container p-8 bg-muted min-h-screen">
      <header className="print-hide flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-heading">Imprimir Cartelas</h1>
          <p className="text-muted-foreground">
            {myOwnedCards.length} cartela(s) pronta(s) para impressão.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar ao Lobby
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </header>

      {myOwnedCards.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">Você não tem cartelas para imprimir.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {myOwnedCards.map(card => (
            <PrintableBingoCard key={card.id} card={card} />
          ))}
        </div>
      )}
    </div>
  );
};

export default PrintView;