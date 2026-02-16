import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  LogIn, LogOut, Coins, Plus, Minus, Trophy, Users, Clock, 
  DoorOpen, Settings, Wallet, CreditCard, Timer
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

const Lobby = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    currentPlayer, registerPlayer, logoutPlayer, buyCredits,
    matches, joinMatch, getPlayerMatchCards,
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [buyAmount, setBuyAmount] = useState(50);
  const [joinCounts, setJoinCounts] = useState<Record<string, number>>({});

  // Countdown timers
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) {
      registerPlayer(playerName.trim());
    }
  };

  const handleJoin = (match: Match) => {
    const count = joinCounts[match.id] || 1;
    const totalCost = count * match.cardPrice;

    if (!currentPlayer || currentPlayer.credits < totalCost) {
      toast({ title: 'Créditos insuficientes', description: 'Compre mais créditos para participar.', variant: 'destructive' });
      return;
    }

    const cards = joinMatch(match.id, count);
    if (cards.length > 0) {
      toast({ title: '🎉 Você entrou na partida!', description: `${cards.length} cartela(s) adquirida(s) por ${totalCost} créditos.` });
    }
  };

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
    if (diff <= 0) return 'Já iniciou!';
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  };

  const openMatches = matches.filter(m => m.status === 'open' || m.status === 'in_progress');
  const waitingMatches = matches.filter(m => m.status === 'waiting');

  const getPrizeDisplay = (match: Match) => {
    if (match.prize.type === 'product') return `🎁 ${match.prize.productName}`;
    if (match.prize.type === 'fixed') return `💰 ${match.prize.value} créditos`;
    return `📊 ${match.prize.value}% do pote`;
  };

  if (!currentPlayer) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="card-container max-w-sm w-full">
          <div className="text-center mb-6">
            <h1 className="font-heading text-3xl font-bold text-foreground mb-2">🎱 Bingo</h1>
            <p className="text-muted-foreground">Entre com seu nome para jogar</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            <Input
              placeholder="Seu nome"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="bg-secondary border-0 text-center text-lg"
            />
            <Button type="submit" className="w-full gradient-primary shadow-button" disabled={!playerName.trim()}>
              <LogIn className="w-4 h-4 mr-2" />
              Entrar
            </Button>
          </form>

          <Button variant="ghost" className="w-full mt-4 text-muted-foreground" onClick={() => navigate('/admin/login')}>
            <Settings className="w-4 h-4 mr-2" />
            Painel Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-heading text-2xl font-bold text-primary-foreground">🎱 Bingo</h1>
              <p className="text-primary-foreground/70 text-sm">Olá, {currentPlayer.name}!</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Credits */}
              <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-2">
                <Wallet className="w-4 h-4 text-primary-foreground" />
                <span className="font-heading font-bold text-primary-foreground">{currentPlayer.credits}</span>
              </div>

              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="text-primary-foreground">
                    <CreditCard className="w-4 h-4 mr-1" />
                    Comprar
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-xs">
                  <DialogHeader>
                    <DialogTitle className="font-heading">Comprar Créditos</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 justify-center">
                      <Button size="icon" variant="outline" onClick={() => setBuyAmount(prev => Math.max(10, prev - 10))}>
                        <Minus className="w-4 h-4" />
                      </Button>
                      <span className="font-heading text-3xl font-bold text-foreground w-20 text-center">{buyAmount}</span>
                      <Button size="icon" variant="outline" onClick={() => setBuyAmount(prev => prev + 10)}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                    <Button className="w-full gradient-accent shadow-button" onClick={() => { buyCredits(buyAmount); toast({ title: `+${buyAmount} créditos adicionados!` }); }}>
                      <Coins className="w-4 h-4 mr-2" />
                      Comprar {buyAmount} créditos
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="ghost" className="text-primary-foreground" onClick={logoutPlayer}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4">
        {/* Waiting matches with countdown */}
        {waitingMatches.length > 0 && (
          <div className="mb-8">
            <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Timer className="w-5 h-5 text-accent" />
              Próximas Partidas
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {waitingMatches.map(match => (
                <div key={match.id} className="card-container border-2 border-dashed border-accent/30">
                  <div className="text-center">
                    <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                    <p className="text-sm text-muted-foreground">{gameTypeLabels[match.gameType]}</p>
                    <div className="mt-3 bg-accent/10 rounded-xl p-4">
                      <p className="text-xs text-muted-foreground mb-1">Começa em</p>
                      <p className="font-heading text-2xl font-bold text-accent">{getCountdown(match.startTime)}</p>
                    </div>
                    <div className="flex justify-center gap-4 mt-3 text-sm text-muted-foreground">
                      <span>{getPrizeDisplay(match)}</span>
                      <span>{match.cardPrice} créditos/cartela</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open matches */}
        <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-primary" />
          Partidas Abertas
        </h2>

        {openMatches.length === 0 ? (
          <div className="card-container text-center py-12">
            <p className="text-muted-foreground">Nenhuma partida aberta no momento.</p>
            <p className="text-sm text-muted-foreground mt-1">Aguarde o admin abrir uma partida.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {openMatches.map(match => {
              const myCards = currentPlayer ? getPlayerMatchCards(match.id, currentPlayer.id) : [];
              const alreadyJoined = myCards.length > 0;
              const cardCount = joinCounts[match.id] || 1;

              return (
                <div key={match.id} className={`card-container ${match.status === 'in_progress' ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                        {match.status === 'in_progress' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent font-medium animate-pulse">
                            AO VIVO
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.gameType]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{match.playerIds.length}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                      </div>
                      <p className="text-sm text-foreground mt-1">{getPrizeDisplay(match)}</p>
                    </div>
                  </div>

                  {/* Called numbers for in_progress */}
                  {match.status === 'in_progress' && match.calledNumbers.length > 0 && (
                    <div className="mb-3">
                      <p className="text-xs text-muted-foreground mb-1">Números sorteados ({match.calledNumbers.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {match.calledNumbers.map(num => (
                          <span key={num} className="w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center">
                            {num}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Player's cards in this match */}
                  {alreadyJoined && (
                    <div className="bg-success/10 rounded-lg p-3 mb-3">
                      <p className="text-sm text-success font-medium">✅ Você tem {myCards.length} cartela(s) nesta partida</p>
                      {match.status === 'in_progress' && (
                        <Button size="sm" className="mt-2 gradient-primary" onClick={() => navigate(`/match/${match.id}`)}>
                          Ver Cartelas
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Join controls */}
                  {match.status === 'open' && (
                    <div className="border-t border-border pt-3 mt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setJoinCounts(prev => ({ ...prev, [match.id]: Math.max(1, (prev[match.id] || 1) - 1) }))}>
                            <Minus className="w-3 h-3" />
                          </Button>
                          <span className="font-heading font-bold text-lg w-8 text-center">{cardCount}</span>
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setJoinCounts(prev => ({ ...prev, [match.id]: Math.min(match.maxCardsPerPlayer - myCards.length, (prev[match.id] || 1) + 1) }))}>
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        <Button className="flex-1 gradient-accent shadow-button" onClick={() => handleJoin(match)} disabled={myCards.length >= match.maxCardsPerPlayer}>
                          <Coins className="w-4 h-4 mr-1" />
                          {myCards.length >= match.maxCardsPerPlayer ? 'Máx. atingido' : `Comprar (${cardCount * match.cardPrice} créditos)`}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Máx: {match.maxCardsPerPlayer} cartelas • {match.cardPrice} créditos/cartela
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Lobby;
