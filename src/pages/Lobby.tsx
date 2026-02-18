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
  Volume2, VolumeX, Trash2, Archive, ArchiveRestore, History, Banknote
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
import { Footer } from '@/components/Footer';
import { Badge } from '@/components/ui/badge';
import { playNotificationSound } from '@/utils/soundUtils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CreditRequestDialog } from '@/components/CreditRequestDialog';
import { MyCreditRequestsDialog } from '@/components/MyCreditRequestsDialog';
import { RedeemRequestDialog } from '@/components/RedeemRequestDialog';
import { MyRedeemRequestsDialog } from '@/components/MyRedeemRequestsDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Lobby = () => {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const { 
    matches, joinMatch, getPlayerMatchCards, playerCards, 
    buyCardUses, createPlayerCard, deletePlayerCard,
    toggleArchivePlayerCard, matchCards, gameSettings, wins,
    redeemRequests
  } = useGame();

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
  const safeRedeemRequests = Array.isArray(redeemRequests) ? redeemRequests : [];
  const pendingRedeemsCount = safeRedeemRequests.filter(r => r.status === 'pending').length;
  const rejectedRedeemsCount = safeRedeemRequests.filter(r => r.status === 'rejected').length;

  const inProgressMatches = sortedMatches.filter(m => m.status === 'in_progress');
  const openMatches = sortedMatches.filter(m => m.status === 'open');
  const waitingMatches = sortedMatches.filter(m => m.status === 'waiting');
  const finishedMatches = sortedMatches.filter(m => m.status === 'finished');

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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
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
                  <div className="flex flex-col items-end">
                    {alreadyJoined ? (
                      <Button size="sm" className="bg-success/10 text-success hover:bg-success/20 h-8 text-xs" onClick={() => navigate(`/match/${match.id}`)}><Tv className="w-3.5 h-3.5 mr-2" /> Acompanhar</Button>
                    ) : match.status === 'open' ? (
                      <Button size="sm" className="gradient-accent shadow-button h-8 text-xs" onClick={() => openJoinDialog(match)}>Entrar na Partida</Button>
                    ) : (
                      <Button size="sm" disabled className="h-8 text-xs">{match.status === 'waiting' ? 'Aguardando' : 'Encerrada'}</Button>
                    )}
                    <span className="text-[10px] text-muted-foreground mt-1">{match.card_price} créditos por cartela</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-4 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground">🎱 Bingo</h1>
            <p className="text-primary-foreground/70 text-[10px] md:text-xs">Olá, {profile.full_name || 'Jogador'}!</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1 bg-primary-foreground/10 rounded-full px-3 py-1.5 md:px-4 md:py-2">
              <Wallet className="w-3.5 h-3.5 text-primary-foreground" />
              <span className="font-heading font-bold text-sm md:text-base text-primary-foreground">{profile.credits}</span>
            </div>
            
            <div className="flex items-center gap-1">
                <CreditRequestDialog gameSettings={gameSettings}>
                <Button size="sm" variant="ghost" className="text-primary-foreground h-8 px-2 md:h-9 md:px-3 text-xs md:text-sm">
                    <Plus className="w-3.5 h-3.5 mr-1" />Créditos
                </Button>
                </CreditRequestDialog>
                
                <RedeemRequestDialog>
                    <Button size="sm" variant="ghost" className="text-primary-foreground h-8 px-2 md:h-9 md:px-3 text-xs md:text-sm">
                        <Banknote className="w-3.5 h-3.5 mr-1" />Resgatar
                    </Button>
                </RedeemRequestDialog>
            </div>

            <Button size="icon" variant="ghost" className="text-primary-foreground h-8 w-8" onClick={() => navigate('/account')}><UserIcon className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="text-primary-foreground h-8 w-8" onClick={signOut}><LogOut className="w-4 h-4" /></Button>
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

        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
            <MyCreditRequestsDialog>
                <Button variant="outline" size="sm" className="rounded-full bg-card whitespace-nowrap text-xs md:text-sm">
                    <History className="w-4 h-4 mr-2" /> Histórico Créditos
                </Button>
            </MyCreditRequestsDialog>
            <MyRedeemRequestsDialog>
                <Button variant="outline" size="sm" className="rounded-full bg-card relative whitespace-nowrap text-xs md:text-sm">
                    <Banknote className="w-4 h-4 mr-2" /> Meus Resgates
                    {rejectedRedeemsCount > 0 ? (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white border border-background">
                            {rejectedRedeemsCount}
                        </span>
                    ) : pendingRedeemsCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-success text-[8px] font-bold text-white border border-background">
                            {pendingRedeemsCount}
                        </span>
                    )}
                </Button>
            </MyRedeemRequestsDialog>
             <Button variant="outline" size="sm" className="rounded-full bg-card whitespace-nowrap text-xs md:text-sm" onClick={() => navigate('/print')} disabled={myOwnedCards.length === 0}>
                <Printer className="w-4 h-4 mr-2" /> Imprimir Cartelas
            </Button>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading text-lg md:text-xl font-bold text-foreground flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Minhas Cartelas ({activeCards.length})</h2>
            <Dialog open={isCreateCardOpen} onOpenChange={setCreateCardOpen}>
                <DialogTrigger asChild><Button size="sm" className="gradient-primary shadow-button h-8 md:h-9 text-xs md:text-sm"><Plus className="w-4 h-4 mr-2" />Criar Cartela</Button></DialogTrigger>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                    <DialogTitle className="font-heading">Criar Nova Cartela</DialogTitle>
                    <DialogDescription>Escolha os números manualmente ou gere uma cartela aleatória.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto pr-4">
                      <div className="space-y-4 pt-4">
                        <Input placeholder="Nome da cartela (ex: Sorte Pura)" value={newCardName} onChange={e => setNewCardName(e.target.value)} className="bg-secondary border-0" />
                        <CardCreator onCardChange={setNewCardNumbers} />
                      </div>
                    </div>
                    <DialogFooter className="pt-4">
                    <DialogClose asChild><Button variant="ghost">Cancelar</Button></DialogClose>
                    <Button onClick={handleCreateCard} disabled={!newCardName.trim() || !newCardNumbers}>Salvar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
          </div>
          {activeCards.length === 0 && !showArchived ? (
            <div className="card-container text-center py-8"><p className="text-sm text-muted-foreground">Você não tem cartelas ativas. Crie uma ou restaure uma arquivada.</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCards.map(card => {
                const activeMatchCard = matchCards.find(mc => mc.player_card_id === card.id && activeMatchIds.has(mc.match_id));
                const markedNumbers = activeMatchCard ? activeMatchCard.marked_numbers : new Set<number>();
                const winCount = wins.filter(w => w.player_card_id === card.id).length;
                return (
                  <div key={card.id} className={`card-container p-3 transition-opacity ${card.uses_left === 0 ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-heading font-semibold text-sm md:text-base text-foreground">{card.name}</h3>
                          {winCount > 0 && <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600"><Trophy className="w-3 h-3" /><span>{winCount}x</span></div>}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: ...{card.id.slice(-6).toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${card.uses_left > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                          {card.uses_left > 0 ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                          <span>{card.uses_left} uso(s)</span>
                        </div>
                        {card.uses_left === 0 && <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => handleBuyUses(card.id)}>Recarregar <Coins className="w-3 h-3 ml-1" /></Button>}
                        <Button size="icon" variant="ghost" className="text-muted-foreground h-7 w-7" onClick={() => toggleArchivePlayerCard(card.id, true)}><Archive className="w-3.5 h-3.5" /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button size="icon" variant="ghost" disabled={winCount > 0} className="text-destructive/70 h-7 w-7"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente a cartela "{card.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletePlayerCard(card.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
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
          )}
        </div>

        <h2 className="font-heading text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-accent" /> Partidas</h2>
        <Tabs defaultValue="in_progress" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="in_progress">Ao Vivo</TabsTrigger>
            <TabsTrigger value="open">Abertas</TabsTrigger>
            <TabsTrigger value="waiting">Aguardando</TabsTrigger>
            <TabsTrigger value="finished">Finalizadas</TabsTrigger>
          </TabsList>
          <TabsContent value="in_progress" className="mt-0">{renderMatchList(inProgressMatches)}</TabsContent>
          <TabsContent value="open" className="mt-0">{renderMatchList(openMatches)}</TabsContent>
          <TabsContent value="waiting" className="mt-0">{renderMatchList(waitingMatches)}</TabsContent>
          <TabsContent value="finished" className="mt-0">{renderMatchList(finishedMatches)}</TabsContent>
        </Tabs>
      </main>

      <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Entrar na Partida</DialogTitle><DialogDescription>Selecione as cartelas que deseja usar.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 space-y-3">
            {profile && activeCards.filter(card => !new Set(getPlayerMatchCards(selectedMatch?.id || '', profile.id).map(c => c.player_card_id)).has(card.id)).map(card => {
                const isSelected = cardsToJoin.has(card.id);
                const isDisabled = card.uses_left === 0;
                return (
                  <div key={card.id} onClick={() => !isDisabled && setCardsToJoin(prev => { const next = new Set(prev); if (isSelected) next.delete(card.id); else next.add(card.id); return next; })} className={`p-3 rounded-lg border-2 ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent bg-secondary'}`}>
                    <div className="flex justify-between items-center"><h3 className="font-heading font-semibold text-sm">{card.name}</h3>{isDisabled && <span className="text-[10px] text-destructive font-medium">Sem usos</span>}</div>
                  </div>
                );
            })}
          </div>
          <DialogFooter><div className="w-full flex justify-between items-center"><span className="font-heading font-semibold text-base md:text-lg">Total: {cardsToJoin.size * (selectedMatch?.card_price || 0)} créditos</span><Button onClick={handleJoinMatch} disabled={cardsToJoin.size === 0}>Confirmar e Pagar</Button></div></DialogFooter>
        </DialogContent>
      </Dialog>
      <Footer />
    </div>
  );
};

export default Lobby;