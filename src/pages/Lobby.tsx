import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match, MatchStatus } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  LogOut, Coins, Plus, Trophy, Users, Settings, Wallet, 
  CreditCard, Timer, DoorOpen, Ticket, Zap, ZapOff, Tv, Printer, Bot, User as UserIcon,
  Volume2, VolumeX, Trash2, Archive, ArchiveRestore
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose 
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { CardCreator } from '@/components/CardCreator';
import { BingoCell } from '@/components/BingoCell';
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { playNotificationSound } from '@/utils/soundUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Lobby = () => {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const { 
    matches, joinMatch, getPlayerMatchCards, playerCards, 
    buyCardUses, buyCredits, createPlayerCard, deletePlayerCard,
    toggleArchivePlayerCard, matchCards, gameSettings, wins
  } = useGame();

  const [buyAmount, setBuyAmount] = useState(50);
  const [now, setNow] = useState(Date.now());
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const prevMatchesRef = useRef<Match[]>([]);

  const [isCreateCardOpen, setCreateCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumbers, setNewCardNumbers] = useState<number[][] | null>(null);

  const [isJoinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [cardsToJoin, setCardsToJoin] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!session) {
      navigate('/login');
    }
  }, [session, navigate]);

  const myOwnedCards = profile ? playerCards.filter(c => c.player_id === profile.id) : [];
  const activeCards = myOwnedCards.filter(c => !c.is_archived);
  const archivedCards = myOwnedCards.filter(c => c.is_archived);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!profile || matches.length === 0) return;

    const myJoinedMatchIds = new Set(
        matchCards.filter(mc => mc.player_id === profile.id).map(mc => mc.match_id)
    );

    matches.forEach(currentMatch => {
        if (!myJoinedMatchIds.has(currentMatch.id) || currentMatch.status !== 'in_progress') {
            return;
        }

        const prevMatch = prevMatchesRef.current.find(m => m.id === currentMatch.id);
        if (prevMatch && prevMatch.called_numbers) {
            const prevNumbers = prevMatch.called_numbers;
            const currentNumbers = currentMatch.called_numbers;

            if (currentNumbers.length > prevNumbers.length) {
                const newNumber = currentNumbers[currentNumbers.length - 1];
                toast.info(`Número sorteado: ${newNumber}!`, {
                  description: `Na partida "${currentMatch.name}"`,
                });
                if (isSoundOn) {
                    playNotificationSound();
                }
            }
        }
    });

    prevMatchesRef.current = JSON.parse(JSON.stringify(matches));
  }, [matches, matchCards, profile, isSoundOn]);

  const handleCreateCard = async () => {
    if (!newCardName.trim() || !newCardNumbers) return;
    const card = await createPlayerCard({ name: newCardName, numbers: newCardNumbers });
    if (card) {
      toast.success('Cartela criada!', { description: `A cartela "${card.name}" foi adicionada à sua coleção.` });
      setCreateCardOpen(false);
      setNewCardName('');
      setNewCardNumbers(null);
    }
  };

  const openJoinDialog = (match: Match) => {
    setSelectedMatch(match);
    setCardsToJoin(new Set());
    setJoinDialogOpen(true);
  };

  const handleJoinMatch = async () => {
    if (!selectedMatch || cardsToJoin.size === 0) return;
    const cardIds = Array.from(cardsToJoin);
    const newMatchCards = await joinMatch(selectedMatch.id, cardIds);
    if (newMatchCards && newMatchCards.length > 0) {
      toast.success('🎉 Você entrou na partida!', { description: `${newMatchCards.length} cartela(s) inscrita(s).` });
      setJoinDialogOpen(false);
    }
  };

  const handleBuyUses = async (cardId: string) => {
    const success = await buyCardUses(cardId);
    if (success) {
      toast.success('Cartela Recarregada!', { description: `Você comprou mais usos para sua cartela.` });
    }
  };

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
    if (diff <= 0) return 'Iniciando...';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h > 0 ? `${h}h ` : ''}${m > 0 ? `${m}m ` : ''}${s}s`;
  };

  const statusOrder: Record<MatchStatus, number> = {
    'in_progress': 1,
    'open': 2,
    'waiting': 3,
    'finished': 4,
  };

  const sortedMatches = [...matches].sort((a, b) => {
    const orderA = statusOrder[a.status];
    const orderB = statusOrder[b.status];
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
  });

  if (!profile) {
    return null;
  }

  const activeMatchIds = new Set(matches.filter(m => m.status === 'in_progress').map(m => m.id));

  const renderMatchStatusBadge = (match: Match) => {
    switch (match.status) {
      case 'waiting':
        return <Badge variant="outline">Aguardando Abertura</Badge>;
      case 'open':
        return <Badge variant="secondary" className="text-primary">Inscrições Abertas</Badge>;
      case 'in_progress':
        return <Badge variant="destructive" className="animate-pulse">AO VIVO</Badge>;
      case 'finished':
        return <Badge variant="outline">Finalizada</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-6 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary-foreground">🎱 Bingo</h1>
            <p className="text-primary-foreground/70 text-sm">Olá, {profile.full_name || 'Jogador'}!</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-full px-4 py-2">
              <Wallet className="w-4 h-4 text-primary-foreground" />
              <span className="font-heading font-bold text-primary-foreground">{profile.credits}</span>
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
                <Button className="w-full gradient-accent shadow-button" onClick={() => { buyCredits(buyAmount); toast.success(`+${buyAmount} créditos!`); }}><Coins className="w-4 h-4 mr-2" />Comprar</Button>
              </DialogContent>
            </Dialog>
            <Button size="icon" variant="ghost" className="text-primary-foreground" onClick={() => setIsSoundOn(!isSoundOn)}>
              {isSoundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="text-primary-foreground" onClick={() => navigate('/account')}><UserIcon className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="text-primary-foreground" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container max-w-6xl mx-auto py-8 px-4 flex-grow">
        {profile.role === 'admin' && (
          <div className="mb-6">
            <Button className="w-full" variant="outline" onClick={() => navigate('/admin')}>
              <Settings className="w-4 h-4 mr-2" /> Acessar Painel de Admin
            </Button>
          </div>
        )}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-xl font-bold text-foreground flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Minhas Cartelas ({activeCards.length})</h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/print')} disabled={myOwnedCards.length === 0}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Dialog open={isCreateCardOpen} onOpenChange={setCreateCardOpen}>
                <DialogTrigger asChild><Button size="sm" className="gradient-primary shadow-button"><Plus className="w-4 h-4 mr-2" />Criar Cartela</Button></DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader><DialogTitle className="font-heading">Criar Nova Cartela</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <Input placeholder="Nome da cartela (ex: Sorte Pura)" value={newCardName} onChange={e => setNewCardName(e.target.value)} className="bg-secondary border-0" />
                    <CardCreator onCardChange={setNewCardNumbers} />
                  </div>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={handleCreateCard} disabled={!newCardName.trim() || !newCardNumbers}>Salvar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {activeCards.length === 0 && !showArchived ? (
            <div className="card-container text-center py-8"><p className="text-muted-foreground">Você não tem cartelas ativas. Crie uma ou restaure uma arquivada.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCards.map(card => {
                const activeMatchCard = matchCards.find(mc => 
                  mc.player_card_id === card.id && activeMatchIds.has(mc.match_id)
                );
                const markedNumbers = activeMatchCard ? activeMatchCard.marked_numbers : new Set<number>();
                const winCount = wins.filter(w => w.player_card_id === card.id).length;
                const hasWins = winCount > 0;

                return (
                  <div key={card.id} className={`card-container p-3 transition-opacity ${card.uses_left === 0 ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-foreground">{card.name}</h3>
                          {hasWins && (
                            <div className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600">
                              <Trophy className="w-3 h-3" />
                              <span>{winCount}x</span>
                            </div>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-mono">ID: ...{card.id.slice(-6).toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${card.uses_left > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {card.uses_left > 0 ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                          <span>{card.uses_left} uso(s)</span>
                        </div>
                        {card.uses_left === 0 && (
                          <Button size="sm" variant="outline" onClick={() => handleBuyUses(card.id)}>
                            Recarregar <Coins className="w-3 h-3 ml-1" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 w-8" onClick={() => toggleArchivePlayerCard(card.id, true)}>
                          <Archive className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" disabled={hasWins} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8 disabled:opacity-50 disabled:cursor-not-allowed">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação não pode ser desfeita. Isso excluirá permanentemente a cartela "{card.name}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deletePlayerCard(card.id)}
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-1">
                      {card.numbers.flat().map((num, i) => (
                        <BingoCell 
                          key={i} 
                          number={num} 
                          isMarked={markedNumbers.has(num)}
                          isFreeSpace={i === 12} 
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {archivedCards.length > 0 && (
            <div className="mt-6">
              <Button variant="link" onClick={() => setShowArchived(!showArchived)}>
                {showArchived ? 'Ocultar Arquivadas' : 'Ver Arquivadas'} ({archivedCards.length})
              </Button>
              {showArchived && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {archivedCards.map(card => (
                    <div key={card.id} className="card-container p-3 opacity-70">
                       <div className="flex justify-between items-center mb-2">
                         <h3 className="font-heading font-semibold text-muted-foreground">{card.name}</h3>
                         <Button size="sm" variant="outline" onClick={() => toggleArchivePlayerCard(card.id, false)}>
                           <ArchiveRestore className="w-4 h-4 mr-2" />
                           Restaurar
                         </Button>
                       </div>
                       <div className="grid grid-cols-5 gap-1">
                        {card.numbers.flat().map((num, i) => (
                          <div key={i} className={`w-12 h-12 rounded-lg flex items-center justify-center text-lg font-semibold bg-secondary/50 ${i === 12 ? 'text-xl' : ''}`}>
                            {i === 12 ? '★' : num}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <h2 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-accent" /> Partidas</h2>
        {matches.length === 0 ? (
          <div className="card-container text-center py-12"><p className="text-muted-foreground">Nenhuma partida criada no momento.</p></div>
        ) : (
          <div className="space-y-4">
            {sortedMatches.map(match => {
              const playersInMatchCount = new Set(matchCards.filter(mc => mc.match_id === match.id).map(mc => mc.player_id)).size;
              const myMatchCards = getPlayerMatchCards(match.id, profile.id);
              const alreadyJoined = myMatchCards.length > 0;
              const canJoin = match.status === 'open';

              if (match.status === 'finished') {
                return (
                  <div key={match.id} className="card-container opacity-70">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-heading font-bold text-lg text-foreground line-through">{match.name}</h3>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span>
                          <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{playersInMatchCount}</span>
                          <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                        </div>
                      </div>
                      {renderMatchStatusBadge(match)}
                    </div>
                    <div className="mt-3 border-t border-border pt-3 text-center">
                      <h4 className="font-heading font-bold text-success text-lg flex items-center justify-center gap-2">
                        <Trophy className="w-5 h-5" />
                        Sorteio Encerrado!
                      </h4>
                      {match.winners.length > 0 && (
                        <p className="text-muted-foreground mt-1">
                          Vencedor(es): <span className="font-semibold text-foreground">{match.winners.map(w => w.playerName).join(', ')}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={match.id} className={`card-container relative ${match.status === 'in_progress' ? 'ring-2 ring-accent' : ''}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-heading font-bold text-lg text-foreground">{match.name}</h3>
                        {renderMatchStatusBadge(match)}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span>
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{playersInMatchCount}</span>
                        <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                        <span className="flex items-center gap-1">
                          {match.is_auto_calling ? <Bot className="w-3.5 h-3.5" /> : <Tv className="w-3.5 h-3.5" />}
                          Sorteio {match.is_auto_calling ? 'Automático' : 'Manual'}
                        </span>
                        {match.is_auto_calling && gameSettings && (
                          <span className="flex items-center gap-1"><Timer className="w-3.5 h-3.5" />{gameSettings.intervalo_sorteio_auto_seg}s / núm.</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      {alreadyJoined ? (
                        <Button size="sm" className="bg-success/10 text-success hover:bg-success/20" onClick={() => navigate(`/match/${match.id}`)}>
                          <Tv className="w-4 h-4 mr-2" /> Acompanhar
                        </Button>
                      ) : canJoin ? (
                        <Button size="sm" className="gradient-accent shadow-button" onClick={() => openJoinDialog(match)}>
                          Entrar na Partida
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          {match.status === 'waiting' ? 'Aguardando Abertura' : 'Inscrições Encerradas'}
                        </Button>
                      )}
                      <span className="text-xs text-muted-foreground mt-1">{match.card_price} créditos por cartela</span>
                    </div>
                  </div>

                  {match.status === 'open' && (
                    <div className="mt-3 border-t border-border pt-3 text-center">
                      <p className="text-sm font-medium text-foreground">
                        A partida inicia em <span className="font-bold font-mono text-accent">{getCountdown(match.start_time)}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(match.start_time), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}

                  {match.status === 'in_progress' && (
                    <div className="mt-3 border-t border-border pt-3 space-y-3">
                      {match.called_numbers.length > 0 && (
                        <div>
                          <p className="text-xs text-muted-foreground font-medium mb-2">
                            Último número sorteado:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                              <span className="w-8 h-8 rounded-full flex items-center justify-center text-lg font-bold bg-accent text-accent-foreground animate-bounce-in">
                                {match.called_numbers[match.called_numbers.length - 1]}
                              </span>
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

      <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Entrar na Partida: {selectedMatch?.name}</DialogTitle></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 space-y-3">
            {(() => {
              if (!selectedMatch || !profile) return null;
              
              const myCardsInThisMatch = getPlayerMatchCards(selectedMatch.id, profile.id);
              const myCardIdsInThisMatch = new Set(myCardsInThisMatch.map(c => c.player_card_id));
              const availableCardsToJoin = myOwnedCards.filter(card => !myCardIdsInThisMatch.has(card.id) && !card.is_archived);

              if (myOwnedCards.filter(c => !c.is_archived).length === 0) {
                return (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground font-medium">Você não tem nenhuma cartela ativa.</p>
                    <p className="text-sm text-muted-foreground mt-1">Crie uma nova cartela ou restaure uma arquivada para poder entrar na partida.</p>
                  </div>
                );
              }

              if (availableCardsToJoin.length === 0) {
                return (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground font-medium">Todas as suas cartelas ativas já estão nesta partida.</p>
                    <p className="text-sm text-muted-foreground mt-1">Você pode acompanhar a partida ao vivo no lobby.</p>
                  </div>
                );
              }

              return availableCardsToJoin.map(card => {
                const isSelected = cardsToJoin.has(card.id);
                const isDisabled = card.uses_left === 0;
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
              });
            })()}
          </div>
          <DialogFooter>
            <div className="w-full flex justify-between items-center">
              <span className="font-heading font-semibold text-lg">Total: {cardsToJoin.size * (selectedMatch?.card_price || 0)} créditos</span>
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