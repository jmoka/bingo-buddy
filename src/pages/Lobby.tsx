import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match, MatchStatus, PlayerCard } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  Coins, Plus, Trophy, Users, Settings, 
  Timer, DoorOpen, Ticket, Zap, ZapOff, Tv, Archive, Trash2, RotateCcw, Star, Loader2, History
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const Lobby = () => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { 
    matches, joinMatch, getPlayerMatchCards, playerCards, 
    buyCardUses, createPlayerCard, deletePlayerCard,
    toggleArchivePlayerCard, matchCards, wins
  } = useGame();

  const [now, setNow] = useState(Date.now());
  const [isCreateCardOpen, setCreateCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumbers, setNewCardNumbers] = useState<number[][] | null>(null);
  const [creditType, setCreditType] = useState<'real' | 'fake'>('real');

  const [isJoinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [cardsToJoin, setCardsToJoin] = useState<Set<string>>(new Set());
  const [isJoining, setIsJoining] = useState(false);
  const [rechargingCardId, setRechargingCardId] = useState<string | null>(null);

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

  const handleCreateCard = async () => {
    if (!newCardName.trim() || !newCardNumbers) return;
    const card = await createPlayerCard({ name: newCardName, numbers: newCardNumbers, creditType });
    if (card) {
      toast.success('Cartela criada!', { description: `A cartela "${card.name}" foi adicionada à sua coleção.` });
      setCreateCardOpen(false);
      setNewCardName('');
      setNewCardNumbers(null);
      setCreditType('real');
    }
  };

  const openJoinDialog = (match: Match) => {
    setSelectedMatch(match);
    setCardsToJoin(new Set());
    setJoinDialogOpen(true);
  };

  const handleJoinMatch = async () => {
    if (!selectedMatch || cardsToJoin.size === 0) return;
    setIsJoining(true);
    try {
      const cardIds = Array.from(cardsToJoin);
      const newMatchCards = await joinMatch(selectedMatch.id, cardIds);
      if (newMatchCards && newMatchCards.length > 0) {
        toast.success('🎉 Você entrou na partida!', { description: `${newMatchCards.length} cartela(s) inscrita(s).` });
        setJoinDialogOpen(false);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleBuyUses = async (cardId: string) => {
    const success = await buyCardUses(cardId);
    if (success) {
      toast.success('Cartela Recarregada!', { description: `Você comprou mais usos para sua cartela.` });
    }
  };

  const handleRechargeInDialog = async (cardId: string) => {
    setRechargingCardId(cardId);
    const success = await buyCardUses(cardId);
    if (success) {
      toast.success('Cartela Recarregada!', { description: `Agora você pode selecioná-la para a partida.` });
    }
    setRechargingCardId(null);
  };

  const getCountdown = (startTime: string) => {
    const diff = new Date(startTime).getTime() - now;
    if (diff <= 0) return null;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h > 0 ? `${h.toString().padStart(2, '0')}:` : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const sortedMatches = [...matches].sort((a, b) => {
    const statusOrder: Record<MatchStatus, number> = { 'in_progress': 1, 'open': 2, 'waiting': 3, 'finished': 4 };
    const orderA = statusOrder[a.status];
    const orderB = statusOrder[b.status];
    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
  });

  if (!profile) return null;

  const activeMatchIds = new Set(matches.filter(m => m.status === 'in_progress').map(m => m.id));
  
  const inProgressMatches = sortedMatches.filter(m => m.status === 'in_progress');
  const openMatches = sortedMatches.filter(m => m.status === 'open');
  const waitingMatches = sortedMatches.filter(m => m.status === 'waiting');
  const finishedMatches = sortedMatches.filter(m => m.status === 'finished');

  const renderCardList = (cards: PlayerCard[]) => {
    if (cards.length === 0) {
      return (
        <div className="card-container text-center py-8">
          <p className="text-sm text-muted-foreground">Nenhuma cartela encontrada nesta categoria.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(card => {
          const activeMatchCard = matchCards.find(mc => mc.player_card_id === card.id && activeMatchIds.has(mc.match_id));
          const markedNumbers = activeMatchCard ? activeMatchCard.marked_numbers : new Set<number>();
          const winCount = wins.filter(w => w.player_card_id === card.id).length;
          const isFake = (card as any).credit_type === 'fake';
          
          return (
            <div key={card.id} className={`card-container p-3 transition-opacity ${card.uses_left === 0 ? 'opacity-80' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-semibold text-sm md:text-base text-foreground">{card.name}</h3>
                    {isFake && <Badge variant="outline" className="text-[9px] h-4 border-amber-400 text-amber-600 bg-amber-400/5">Brincar</Badge>}
                    {winCount > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600 border border-amber-400/30">
                        <Trophy className="w-3 h-3" />
                        <span>{winCount}x</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: ...{card.id.slice(-6).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${card.uses_left > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {card.uses_left > 0 ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                    <span>{card.uses_left} uso(s)</span>
                  </div>
                  
                  {card.uses_left === 0 && !card.is_archived && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" onClick={() => handleBuyUses(card.id)}>
                      Recarregar <Coins className="w-3 h-3 ml-1" />
                    </Button>
                  )}

                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="text-muted-foreground h-7 w-7" 
                    title={card.is_archived ? "Desarquivar" : "Arquivar"}
                    onClick={() => toggleArchivePlayerCard(card.id, !card.is_archived)}
                  >
                    {card.is_archived ? <RotateCcw className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive/70 h-7 w-7">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir Cartela?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Você tem certeza que deseja excluir permanentemente a cartela "{card.name}"? 
                          {winCount > 0 && " Esta cartela já foi vitoriosa no passado!"}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletePlayerCard(card.id)}>
                          Excluir Agora
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {card.numbers.flat().map((num, i) => (
                  <BingoCell key={i} number={num} isMarked={markedNumbers.has(num)} isFreeSpace={i === 12} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMatchList = (matchesToRender: Match[]) => {
    if (matchesToRender.length === 0) {
      return (
        <div className="card-container text-center py-12">
          <p className="text-sm text-muted-foreground">Nenhuma partida nesta categoria.</p>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {matchesToRender.map(match => {
          const playersInMatchCount = new Set(matchCards.filter(mc => mc.match_id === match.id).map(mc => mc.player_id)).size;
          const myMatchCards = getPlayerMatchCards(match.id, profile.id);
          const alreadyJoined = myMatchCards.length > 0;
          const countdown = (match.status === 'waiting' || match.status === 'open') ? getCountdown(match.start_time) : null;
          return (
            <div key={match.id} className={`card-container relative p-0 overflow-hidden ${match.status === 'in_progress' ? 'ring-2 ring-accent' : ''} ${match.status === 'finished' ? 'opacity-70' : ''}`}>
              {match.prize.type === 'product' && match.prize_image_url && (
                <img src={match.prize_image_url} alt={match.prize.productName || 'Prêmio'} className="w-full h-32 object-cover" />
              )}
              <div className="p-4">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center flex-wrap gap-2 mb-1">
                      <h3 className={`font-heading font-bold text-base md:text-lg text-foreground ${match.status === 'finished' ? 'line-through' : ''}`}>{match.name}</h3>
                      {match.status === 'waiting' && <Badge variant="outline" className="text-[10px] h-5">Aguardando</Badge>}
                      {match.status === 'open' && <Badge variant="secondary" className="text-primary text-[10px] h-5">Aberto</Badge>}
                      {match.status === 'in_progress' && <Badge variant="destructive" className="animate-pulse text-[10px] h-5">AO VIVO</Badge>}
                      {match.status === 'finished' && <Badge variant="outline" className="text-[10px] h-5">Finalizada</Badge>}
                      {countdown && (
                        <Badge variant="outline" className="font-mono text-[10px] h-5">
                            <Timer className="w-3 h-3 mr-1" />
                            {countdown}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Trophy className="w-3.5 h-3.5" />{gameTypeLabels[match.game_type]}</span>
                      <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{playersInMatchCount}</span>
                      {match.min_players > 1 && <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{match.min_players} min</span>}
                      <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" />Pote: {match.pot}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      {match.status === 'in_progress' && (
                        <Button size="sm" className="bg-success/10 text-success hover:bg-success/20 h-8 text-xs w-full sm:w-auto" onClick={() => navigate(`/match/${match.id}`)}><Tv className="w-3.5 h-3.5 mr-2" /> Acompanhar</Button>
                      )}
                      {match.status === 'open' && (
                        <>
                          {alreadyJoined && (
                            <Button size="sm" variant="outline" className="h-8 text-xs w-full sm:w-auto" onClick={() => navigate(`/match/${match.id}`)}><Tv className="w-3.5 h-3.5 mr-2" /> Acompanhar</Button>
                          )}
                          <Button size="sm" className="gradient-accent shadow-button h-8 text-xs w-full sm:w-auto" onClick={() => openJoinDialog(match)}>
                            {alreadyJoined ? 'Adicionar Cartelas' : 'Entrar na Partida'}
                          </Button>
                        </>
                      )}
                      {match.status === 'waiting' && (
                        <Button size="sm" disabled className="h-8 text-xs w-full sm:w-auto">Aguardando</Button>
                      )}
                      {match.status === 'finished' && (
                        <Button size="sm" disabled className="h-8 text-xs w-full sm:w-auto">Encerrada</Button>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-1">{match.card_price} créditos por cartela</span>
                  </div>
                </div>
                {(alreadyJoined || match.status === 'in_progress') && (
                  <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                    {match.status === 'in_progress' && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <History className="w-3 h-3" />
                          Últimos 5 Sorteados
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {match.called_numbers.length > 0 ? (
                            match.called_numbers.slice(-5).reverse().map((num, index) => (
                              <span key={index} className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-accent text-accent-foreground shadow-md' : 'bg-secondary text-secondary-foreground'}`}>
                                {num}
                              </span>
                            ))
                          ) : (
                            <p className="text-xs italic text-muted-foreground">Nenhum número sorteado ainda.</p>
                          )}
                        </div>
                      </div>
                    )}
                    {alreadyJoined && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Ticket className="w-3 h-3" />
                          Suas Cartelas na Partida ({myMatchCards.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {myMatchCards.map(card => (
                            <Badge key={card.id} variant="outline" className="font-medium text-xs">
                              {card.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {profile.role === 'admin' && (
        <div className="mb-6">
          <Button className="w-full" variant="outline" onClick={() => navigate('/admin')}>
            <Settings className="w-4 h-4 mr-2" /> Acessar Painel de Admin
          </Button>
        </div>
      )}

      <div className="mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
          <h2 className="font-heading text-lg md:text-xl font-bold text-foreground flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" /> Minhas Cartelas
          </h2>
          <Dialog open={isCreateCardOpen} onOpenChange={setCreateCardOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary shadow-button h-8 md:h-9 text-xs md:text-sm w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />Criar Cartela
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl flex flex-col max-h-[90vh]">
                  <DialogHeader className="flex-shrink-0">
                    <DialogTitle className="font-heading">Criar Nova Cartela</DialogTitle>
                    <DialogDescription>Escolha o tipo de crédito e os números da sua cartela.</DialogDescription>
                  </DialogHeader>
                  <div className="flex-grow overflow-y-auto -mx-6 px-6">
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label>Tipo de Crédito</Label>
                        <RadioGroup
                          value={creditType}
                          onValueChange={(v: 'real' | 'fake') => setCreditType(v)}
                          className="grid grid-cols-2 gap-4"
                        >
                          <div>
                            <RadioGroupItem value="real" id="real" className="peer sr-only" />
                            <Label
                              htmlFor="real"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                              <Coins className="mb-2 h-6 w-6" />
                              <span className="text-xs font-bold uppercase">Reais</span>
                              <span className="text-[10px] text-muted-foreground mt-1">{profile.credits} cr.</span>
                            </Label>
                          </div>
                          <div>
                            <RadioGroupItem value="fake" id="fake" className="peer sr-only" />
                            <Label
                              htmlFor="fake"
                              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                            >
                              <Star className="mb-2 h-6 w-6" />
                              <span className="text-xs font-bold uppercase">Brincar</span>
                              <span className="text-[10px] text-muted-foreground mt-1">{profile.fake_credits} cr.</span>
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>

                      <div className="space-y-2">
                        <Label>Nome da Cartela</Label>
                        <Input placeholder="Ex: Sorte Pura" value={newCardName} onChange={e => setNewCardName(e.target.value)} className="bg-secondary border-0" />
                      </div>

                      <CardCreator onCardChange={setNewCardNumbers} />
                    </div>
                  </div>
                  <DialogFooter className="flex-shrink-0">
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={handleCreateCard} disabled={!newCardName.trim() || !newCardNumbers}>
                      Salvar (Custa {useGame().gameSettings?.custo_nova_cartela || 10} cr.)
                    </Button>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 h-10">
            <TabsTrigger value="active" className="text-xs">
              Ativas ({activeCards.length})
            </TabsTrigger>
            <TabsTrigger value="archived" className="text-xs">
              Arquivadas ({archivedCards.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="mt-0">
            {renderCardList(activeCards)}
          </TabsContent>
          
          <TabsContent value="archived" className="mt-0">
            {renderCardList(archivedCards)}
          </TabsContent>
        </Tabs>
      </div>

      <h2 className="font-heading text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-accent" /> Partidas</h2>
      <Tabs defaultValue="in_progress" className="w-full">
        <TabsList className="grid w-full h-auto p-1 grid-cols-2 sm:grid-cols-4 mb-6">
          <TabsTrigger value="in_progress" className="flex items-center gap-2">
            Ao Vivo
            {inProgressMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                {inProgressMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="open" className="flex items-center gap-2">
            Abertas
            {openMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                {openMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="waiting" className="flex items-center gap-2">
            Aguardando
            {waitingMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {waitingMatches.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished" className="flex items-center gap-2">
            Finalizadas
            {finishedMatches.length > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-[10px] font-bold text-white">
                {finishedMatches.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="in_progress" className="mt-2">{renderMatchList(inProgressMatches)}</TabsContent>
        <TabsContent value="open" className="mt-2">{renderMatchList(openMatches)}</TabsContent>
        <TabsContent value="waiting" className="mt-2">{renderMatchList(waitingMatches)}</TabsContent>
        <TabsContent value="finished" className="mt-2">{renderMatchList(finishedMatches)}</TabsContent>
      </Tabs>

      <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Entrar na Partida</DialogTitle><DialogDescription>Selecione as cartelas que deseja usar.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 space-y-3">
            {profile && activeCards.filter(card => !new Set(getPlayerMatchCards(selectedMatch?.id || '', profile.id).map(c => c.player_card_id)).has(card.id)).map(card => {
                const isSelected = cardsToJoin.has(card.id);
                const isDisabled = card.uses_left === 0;
                const isRechargingThisCard = rechargingCardId === card.id;
                return (
                  <div 
                    key={card.id} 
                    onClick={() => !isDisabled && !isRechargingThisCard && setCardsToJoin(prev => { const next = new Set(prev); if (isSelected) next.delete(card.id); else next.add(card.id); return next; })} 
                    className={`p-3 rounded-lg border-2 transition-all ${isDisabled ? 'opacity-60' : 'cursor-pointer'} ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary'}`}
                  >
                    <div className="flex justify-between items-center">
                      <h3 className="font-heading font-semibold text-sm">{card.name}</h3>
                      {isDisabled ? (
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs px-2"
                          onClick={(e) => { e.stopPropagation(); handleRechargeInDialog(card.id); }}
                          disabled={isRechargingThisCard}
                        >
                          {isRechargingThisCard ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Coins className="w-3 h-3 mr-1" /> Recarregar</>}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs">{card.uses_left} uso(s)</Badge>
                      )}
                    </div>
                  </div>
                );
            })}
          </div>
          <DialogFooter>
            <div className="w-full flex justify-between items-center">
              <span className="font-heading font-semibold text-base md:text-lg">Total: {cardsToJoin.size * (selectedMatch?.card_price || 0)} créditos</span>
              <Button onClick={handleJoinMatch} disabled={cardsToJoin.size === 0 || isJoining}>
                {isJoining ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Confirmando...</>
                ) : (
                  'Confirmar e Pagar'
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Lobby;