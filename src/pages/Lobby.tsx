import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  LogIn, LogOut, Coins, Plus, Trophy, Users, Settings, Wallet, 
  CreditCard, Timer, DoorOpen, Ticket, Check, Zap, ZapOff, Tv, Printer, Bot
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CardCreator } from '@/components/CardCreator';
import { BingoCell } from '@/components/BingoCell';
import { Footer } from '@/components/Footer';

const Lobby = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { 
    currentPlayer, registerPlayer, logoutPlayer, buyCredits, createPlayerCard,
    matches, joinMatch, getPlayerMatchCards, playerCards, buyCardUses, gameSettings,
  } = useGame();

  const [playerName, setPlayerName] = useState('');
  const [buyAmount, setBuyAmount] = useState(50);
  const [now, setNow] = useState(Date.now());

  // State for creating a new card
  const [isCreateCardOpen, setCreateCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumbers, setNewCardNumbers] = useState<number[][] | null>(null);

  // State for joining a match
  const [isJoinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [cardsToJoin, setCardsToJoin] = useState<Set<string>>(new Set());

  const myOwnedCards = playerCards.filter(c => c.playerId === currentPlayer?.id);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (playerName.trim()) registerPlayer(playerName.trim());
  };

  const handleCreateCard = () => {
    if (!newCardName.trim() || !newCardNumbers) return;
    const card = createPlayerCard({ name: newCardName, numbers: newCardNumbers });
    if (card) {
      toast({ title: 'Cartela criada!', description: `A cartela "${card.name}" foi adicionada à sua coleção.` });
      setCreateCardOpen(false);
      setNewCardName('');
      setNewCardNumbers(null);
    } else {
      toast({ title: 'Erro', description: 'Créditos insuficientes para criar a cartela.', variant: 'destructive' });
    }
  };

  const openJoinDialog = (match: Match) => {
    setSelectedMatch(match);
    setCardsToJoin(new Set());
    setJoinDialogOpen(true);
  };

  const handleJoinMatch = () => {
    if (!selectedMatch || cardsToJoin.size === 0) return;
    const cardIds = Array.from(cardsToJoin);
    const newMatchCards = joinMatch(selectedMatch.id, cardIds);
    if (newMatchCards.length > 0) {
      toast({ title: '🎉 Você entrou na partida!', description: `${newMatchCards.length} cartela(s) inscrita(s).` });
      setJoinDialogOpen(false);
    } else {
      toast({ title: 'Erro ao entrar', description: 'Verifique seus créditos, o status da partida ou os usos das cartelas.', variant: 'destructive' });
    }
  };

  const handleBuyUses = (cardId: string) => {
    if (buyCardUses(cardId)) {
      toast({ title: 'Cartela Recarregada!', description: `Você comprou mais ${gameSettings.usesPerRecharge} uso(s) para sua cartela.` });
    } else {
      toast({ title: 'Créditos insuficientes', description: `Você precisa de ${gameSettings.cardRechargeCost} créditos para recarregar.`, variant: 'destructive' });
    }
  };

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
    if (diff <= 0) return 'Já iniciou!';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s}s`;
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
            <Input placeholder="Seu nome" value={playerName} onChange={e => setPlayerName(e.target.value)} className="bg-secondary border-0 text-center text-lg" />
            <Button type="submit" className="w-full gradient-primary shadow-button" disabled={!playerName.trim()}>
              <LogIn className="w-4 h-4 mr-2" /> Entrar
            </Button>
          </form>
          <Button variant="ghost" className="w-full mt-4 text-muted-foreground" onClick={() => navigate('/admin/login')}>
            <Settings className="w-4 h-4 mr-2" /> Painel Admin
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary-foreground">🎱 Bingo</h1>
            <p className="text-primary-foreground/70 text-sm">Olá, {currentPlayer.name}!</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-2">
              <Wallet className="w-4 h-4 text-primary-foreground" />
              <span className="font-heading font-bold text-primary-foreground">{currentPlayer.credits}</span>
            </div>
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="ghost" className="text-primary-foreground"><CreditCard className="w-4 h-4 mr-1" />Comprar</Button></DialogTrigger>
              <DialogContent className="max-w-xs">
                <DialogHeader><DialogTitle className="font-heading">Comprar Créditos</DialogTitle></DialogHeader>
                <div className="flex items-center gap-3 justify-center my-4">
                  <Button size="icon" variant="outline" onClick={() => setBuyAmount(p => Math.max(10, p - 10))}>-</Button>
                  <span className="font-heading text-3xl font-bold w-20 text-center">{buyAmount}</span>
                  <Button size="icon" variant="outline" onClick={() => setBuyAmount(p => p + 10)}>+</Button>
                </div>
                <Button className="w-full gradient-accent shadow-button" onClick={() => { buyCredits(buyAmount); toast({ title: `+${buyAmount} créditos!` }); }}><Coins className="w-4 h-4 mr-2" />Comprar</Button>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="ghost" className="text-primary-foreground" onClick={logoutPlayer}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        {/* My Cards */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Minhas Cartelas ({myOwnedCards.length})</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/print')} disabled={myOwnedCards.length === 0}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Dialog open={isCreateCardOpen} onOpenChange={(isOpen) => {
                setCreateCardOpen(isOpen);
                if (!isOpen) {
                  setNewCardName('');
                  setNewCardNumbers(null);
                }
              }}>
                <DialogTrigger asChild><Button size="sm" className="gradient-primary shadow-button"><Plus className="w-4 h-4 mr-2" />Criar Cartela</Button></DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle className="font-heading">Criar Nova Cartela</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input placeholder="Nome da cartela (ex: Sorte Pura)" value={newCardName} onChange={e => setNewCardName(e.target.value)} className="bg-secondary border-0" />
                    <CardCreator onCardChange={setNewCardNumbers} />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={handleCreateCard} disabled={!newCardName.trim() || !newCardNumbers}>Salvar ({gameSettings.newCardCost} créditos)</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {myOwnedCards.length === 0 ? (
            <div className="card-container text-center py-8"><p className="text-muted-foreground">Você ainda não tem cartelas. Crie uma!</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myOwnedCards.map(card => (
                <div key={card.id} className={`card-container p-3 transition-opacity ${card.usesLeft === 0 ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-heading font-semibold text-foreground">{card.name}</h3>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${card.usesLeft > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                        {card.usesLeft > 0 ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                        <span>{card.usesLeft} uso(s)</span>
                      </div>
                      {card.usesLeft === 0 && (
                        <Button size="sm" variant="outline" onClick={() => handleBuyUses(card.id)}>
                          Recarregar ({gameSettings.cardRechargeCost} <Coins className="w-3 h-3 ml-1" />)
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    {card.numbers.flat().map((num, i) => <BingoCell key={i} number={num} isMarked={false} isFreeSpace={i === 12} />)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Matches */}
        <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-accent" /> Partidas</h2>
        {matches.filter(m => m.status !== 'finished').length === 0 ? (
          <div className="card-container text-center py-12"><p className="text-muted-foreground">Nenhuma partida disponível no momento.</p></div>
        ) : (
          <div className="space-y-4">
            {matches.filter(m => m.status !== 'finished').map(match => {
              const myMatchCards = getPlayerMatchCards(match.id, currentPlayer.id);
              const alreadyJoined = myMatchCards.length > 0;
              const canJoin = (match.status === 'open' || match.status === 'waiting') && myOwnedCards.some(c => c.usesLeft > 0);
              const countdown = match.nextAutoCallTimestamp ? Math.max(0, Math.round((match.nextAutoCallTimestamp - now) / 1000)) : null;

              return (
                <div key={match.id} className={`card-container ${match.status === 'in_progress' ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.gameType]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{match.playerIds.length}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                        {match.status === 'waiting' && <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{getCountdown(match.startTime)}</span>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {alreadyJoined ? (
                        <Button size="sm" className="bg-success/10 text-success hover:bg-success/20" onClick={() => navigate(`/match/${match.id}`)}>
                          <Tv className="w-4 h-4 mr-2" /> Acompanhar ao vivo
                        </Button>
                      ) : canJoin ? (
                        <Button size="sm" className="gradient-accent shadow-button" onClick={() => openJoinDialog(match)}>
                          Entrar na Partida
                        </Button>
                      ) : null}
                      <span className="text-xs text-muted-foreground mt-1">{match.cardPrice} créditos por cartela</span>
                    </div>
                  </div>

                  {match.status === 'in_progress' && (
                    <div className="mt-3 border-t border-border pt-3 space-y-3">
                      {match.isAutoCalling && countdown !== null && (
                        <div className="flex items-center gap-2 text-sm text-accent">
                          <Bot className="w-4 h-4" />
                          <span className="font-medium">Sorteio automático:</span>
                          <span className="font-bold font-mono bg-accent/10 rounded px-2 py-1 text-xs">
                            Próximo em {countdown}s
                          </span>
                        </div>
                      )}
                      {match.calledNumbers.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-2">
                            Números Sorteados ({match.calledNumbers.length} total)
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {match.calledNumbers.map((num, index) => (
                              <span 
                                key={num} 
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold
                                  ${index === match.calledNumbers.length - 1 ? 'bg-accent text-accent-foreground animate-bounce-in' : 'bg-secondary text-secondary-foreground'}`}
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Join Match Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Entrar na Partida: {selectedMatch?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 space-y-3">
            {myOwnedCards.map(card => {
              const isSelected = cardsToJoin.has(card.id);
              const isDisabled = card.usesLeft === 0;
              return (
                <div 
                  key={card.id} 
                  onClick={() => !isDisabled && setCardsToJoin(prev => {
                    const next = new Set(prev);
                    if (isSelected) next.delete(card.id); else next.add(card.id);
                    return next;
                  })} 
                  className={`p-3 rounded-lg border-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary'}`}
                >
                  <div className="flex justify-between items-center">
                    <h3 className="font-heading font-semibold">{card.name}</h3>
                    {isDisabled && <span className="text-xs text-destructive font-medium">Sem usos</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <div className="w-full flex justify-between items-center">
              <span className="font-heading font-semibold text-lg">Total: {cardsToJoin.size * (selectedMatch?.cardPrice || 0)} créditos</span>
              <Button onClick={handleJoinMatch} disabled={cardsToJoin.size === 0}>
                Confirmar e Pagar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default Lobby;