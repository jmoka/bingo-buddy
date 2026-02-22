import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match, MatchStatus, PlayerCard } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  Coins, Plus, Trophy, Users, Settings, 
  Timer, DoorOpen, Ticket, Zap, ZapOff, Tv, Archive, Trash2, RotateCcw, Star, Loader2, History, LogOut, TrendingUp, Target, Flame, Bot, CalendarDays, Clock, Crown
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
import { cn } from '@/lib/utils';
import { format, addMinutes, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const Lobby = () => {
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const { 
    matches, joinMatch, getPlayerMatchCards, playerCards, 
    buyCardUses, createPlayerCard, deletePlayerCard,
    toggleArchivePlayerCard, matchCards, wins, leaveMatch, gameSettings
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

  // Cálculo das próximas 24 partidas (Lógica de horários fixos baseada na configuração)
  const schedule = useMemo(() => {
    if (!gameSettings?.auto_engine_enabled) return [];
    
    const interval = gameSettings.auto_engine_interval_mins || 60;
    const startHour = gameSettings.auto_engine_start_hour || 0;
    const times = [];
    
    // Começa do início do dia atual + hora de início configurada
    let checkTime = startOfDay(new Date()).getTime() + (startHour * 3600000);
    const limit = addMinutes(new Date(), 24 * 60).getTime();

    while (checkTime < limit) {
      if (checkTime > now) {
        times.push(new Date(checkTime));
      }
      checkTime += interval * 60 * 1000;
      if (times.length >= 24) break;
    }
    
    return times;
  }, [gameSettings, now]);

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

  const getMatchCountdown = (startTime: string) => {
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

  const totalPot = matches.filter(m => m.status !== 'finished').reduce((acc, m) => acc + Number(m.pot || 0), 0);
  const totalPlayers = new Set(matchCards.filter(mc => {
    const m = matches.find(match => match.id === mc.match_id);
    return m && m.status !== 'finished';
  }).map(mc => mc.player_id)).size;

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
      <div className="space-y-6">
        {matchesToRender.map(match => {
          const allCardsInMatch = matchCards.filter(mc => mc.match_id === match.id);
          const playersInMatchCount = new Set(allCardsInMatch.map(mc => mc.player_id)).size;
          const totalCardsInMatch = allCardsInMatch.length;
          
          const myMatchCards = getPlayerMatchCards(match.id, profile.id);
          const alreadyJoined = myMatchCards.length > 0;
          const countdownMatch = (match.status === 'waiting' || match.status === 'open') ? getMatchCountdown(match.start_time) : null;

          const winChance = totalCardsInMatch > 0 ? (myMatchCards.length / totalCardsInMatch) * 100 : 0;

          const prizeValue = match.prize.type === 'percentage' 
            ? (Number(match.pot || 0) * (Number(match.prize.value) || 0)) / 100 
            : (Number(match.prize.value) || 0);

          return (
            <div key={match.id} className={cn(
              "card-container relative p-0 overflow-hidden border-2 transition-all duration-500",
              match.status === 'in_progress' ? 'border-accent ring-4 ring-accent/20' : 'border-transparent',
              match.status === 'finished' ? 'opacity-75 grayscale-[0.5]' : ''
            )}>
              {match.prize.type === 'product' && match.prize_image_url ? (
                <div className="relative h-40 w-full">
                  <img src={match.prize_image_url} alt={match.prize.productName || 'Prêmio'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-3 left-4">
                    <Badge className="bg-accent text-white border-none mb-1">PRÊMIO ESPECIAL</Badge>
                    <h3 className="font-heading font-bold text-xl text-white drop-shadow-md">{match.prize.productName}</h3>
                  </div>
                </div>
              ) : (
                <div className={cn(
                  "h-2 w-full",
                  match.status === 'in_progress' ? 'bg-accent' : 'bg-primary'
                )} />
              )}

              <div className="p-5">
                <div className="flex flex-col lg:flex-row gap-6">
                  <div className="flex-grow space-y-4">
                    <div className="flex items-center flex-wrap gap-2">
                      <h3 className="font-heading font-bold text-xl md:text-2xl text-foreground">{match.name}</h3>
                      {match.status === 'in_progress' && <Badge variant="destructive" className="animate-pulse px-3 py-1">AO VIVO</Badge>}
                      {match.status === 'open' && <Badge className="bg-success text-white px-3 py-1">INSCRIÇÕES ABERTAS</Badge>}
                      {countdownMatch && (
                        <Badge variant="outline" className="font-mono text-sm border-primary/30 text-primary bg-primary/5">
                            <Timer className="w-4 h-4 mr-2" />
                            {countdownMatch}
                        </Badge>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-4">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <span className="text-sm font-medium">{gameTypeLabels[match.game_type]}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Users className="w-4 h-4 text-blue-500" />
                        <span className="text-sm font-medium">{playersInMatchCount} Jogadores</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ticket className="w-4 h-4 text-purple-500" />
                        <span className="text-sm font-medium">{totalCardsInMatch} Cartelas em jogo</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 min-w-[300px]">
                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-primary/5 border border-primary/10">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Pote Total</span>
                      <div className="flex items-center gap-1">
                        <Coins className="w-4 h-4 text-primary" />
                        <span className="text-xl font-bold font-heading">{Number(match.pot || 0).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-success/5 border border-success/10">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-success mb-1">Prêmio Estimado</span>
                      <div className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-success" />
                        <span className="text-xl font-bold font-heading text-success">{Number(prizeValue).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-accent/5 border border-accent/10 col-span-2 sm:col-span-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">Sua Chance</span>
                      <div className="flex items-center gap-1">
                        <Target className="w-4 h-4 text-accent" />
                        <span className="text-xl font-bold font-heading text-accent">{winChance.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="text-center sm:text-left">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Custo de Entrada</p>
                      <p className="text-lg font-bold text-foreground">{Number(match.card_price || 0).toFixed(2)} créditos <span className="text-xs font-normal text-muted-foreground">/ cartela</span></p>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full sm:w-auto">
                    {match.status === 'in_progress' && (
                      <Button className="flex-grow sm:flex-grow-0 bg-accent hover:bg-accent/90 text-white font-bold px-8 h-12 rounded-xl shadow-lg shadow-accent/20" onClick={() => navigate(`/match/${match.id}`)}>
                        <Tv className="w-5 h-5 mr-2" /> ASSISTIR AO VIVO
                      </Button>
                    )}
                    
                    {match.status === 'open' && (
                      <>
                        {alreadyJoined && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" className="text-destructive hover:bg-destructive/5 h-12 px-4">
                                <LogOut className="w-5 h-5 mr-2" /> Sair
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Sair da Partida?</AlertDialogTitle>
                                <AlertDialogDescription>Suas cartelas serão removidas e os créditos estornados.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => leaveMatch(match.id)}>Confirmar Saída</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <Button className="flex-grow sm:flex-grow-0 gradient-accent hover:opacity-90 text-white font-bold px-10 h-12 rounded-xl shadow-lg shadow-accent/30 text-base" onClick={() => openJoinDialog(match)}>
                          {alreadyJoined ? 'ADICIONAR MAIS CARTELAS' : 'ENTRAR NA PARTIDA AGORA'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {match.status === 'open' && match.min_players > 1 && (
                  <div className="mt-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground mb-1">
                      <span>Progresso de Jogadores</span>
                      <span>{playersInMatchCount} / {match.min_players} Mínimo</span>
                    </div>
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-1000" 
                        style={{ width: `${Math.min(100, (playersInMatchCount / match.min_players) * 100)}%` }} 
                      />
                    </div>
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

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
        <div className="card-container bg-gradient-to-br from-primary to-primary/80 text-white border-none p-6 flex flex-col justify-between relative overflow-hidden group">
          <Coins className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Pote Acumulado Total</p>
            <h2 className="text-4xl font-bold font-heading">{Number(totalPot).toFixed(2)} <span className="text-lg font-normal opacity-70">cr.</span></h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <TrendingUp className="w-4 h-4" />
            <span>Crescendo em tempo real!</span>
          </div>
        </div>

        <div 
          className="card-container bg-gradient-to-br from-accent to-accent/80 text-white border-none p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          onClick={() => navigate('/active-players')}
        >
          <Users className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 -rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Jogadores Ativos</p>
            <h2 className="text-4xl font-bold font-heading">{totalPlayers} <span className="text-lg font-normal opacity-70">online</span></h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <Flame className="w-4 h-4" />
            <span>A rodada está quente!</span>
          </div>
        </div>

        <div 
          className="card-container bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          onClick={() => navigate('/trophies')}
        >
          <Trophy className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-6 group-hover:scale-110 transition-transform duration-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Suas Vitórias</p>
            <h2 className="text-4xl font-bold font-heading">{wins.length} <span className="text-lg font-normal opacity-70">troféus</span></h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <Star className="w-4 h-4" />
            <span>Rumo ao próximo Bingo!</span>
          </div>
        </div>

        <div 
          className="card-container bg-gradient-to-br from-yellow-500 to-yellow-600 text-white border-none p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer"
          onClick={() => navigate('/ranking')}
        >
          <Crown className="absolute -right-4 -bottom-4 w-32 h-32 text-white/10 rotate-12 group-hover:scale-110 transition-transform duration-500" />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest opacity-80 mb-1">Hall da Fama</p>
            <h2 className="text-4xl font-bold font-heading">Ranking</h2>
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm font-medium bg-white/10 w-fit px-3 py-1 rounded-full backdrop-blur-sm">
            <Trophy className="w-4 h-4" />
            <span>Veja os melhores!</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LATERAL ESQUERDA: AGENDA (Apenas se motor ativo) */}
        {gameSettings?.auto_engine_enabled && (
            <div className="lg:col-span-3 space-y-6">
                <div className="card-container p-5 border-2 border-primary/20 bg-primary/5">
                    <h3 className="font-heading font-bold text-lg flex items-center gap-2 mb-4 text-primary">
                        <CalendarDays className="w-5 h-5" /> Agenda de Hoje
                    </h3>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {schedule.map((time, idx) => {
                          const diff = time.getTime() - now;
                          const countdownString = diff > 0 
                              ? `${Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0')}:${Math.floor((diff % 60000) / 1000).toString().padStart(2, '0')}`
                              : "Iniciando...";

                          return (
                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/50 shadow-sm group hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                                        {format(time, 'HH:mm')}
                                    </div>
                                    <span className="text-xs font-bold text-muted-foreground">Próxima Partida</span>
                                </div>
                                <Badge variant="outline" className="font-mono text-xs">
                                    <Clock className="w-3 h-3 mr-1.5" />
                                    {countdownString}
                                </Badge>
                            </div>
                          );
                        })}
                        {schedule.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center py-4 italic">Nenhuma partida agendada para as próximas horas.</p>
                        )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-4 text-center leading-tight">
                        * Horários baseados no intervalo de {gameSettings.auto_engine_interval_mins} min.
                    </p>
                </div>
            </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className={cn(
            "space-y-12",
            gameSettings?.auto_engine_enabled ? "lg:col-span-9" : "lg:col-span-12"
        )}>
            
            {/* SEÇÃO DE PARTIDAS */}
            <div>
                <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <DoorOpen className="w-6 h-6 text-accent" /> Partidas Disponíveis
                </h2>
                <Tabs defaultValue="in_progress" className="w-full">
                <TabsList className="grid w-full h-auto p-1 grid-cols-2 sm:grid-cols-4 mb-6 bg-muted/50">
                    <TabsTrigger value="in_progress" className="flex items-center gap-2 py-3">
                    Ao Vivo
                    {inProgressMatches.length > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                        {inProgressMatches.length}
                        </span>
                    )}
                    </TabsTrigger>
                    <TabsTrigger value="open" className="flex items-center gap-2 py-3">
                    Abertas
                    {openMatches.length > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                        {openMatches.length}
                        </span>
                    )}
                    </TabsTrigger>
                    <TabsTrigger value="waiting" className="flex items-center gap-2 py-3">
                    Aguardando
                    {waitingMatches.length > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                        {waitingMatches.length}
                        </span>
                    )}
                    </TabsTrigger>
                    <TabsTrigger value="finished" className="flex items-center gap-2 py-3">
                    Finalizadas
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="in_progress" className="mt-2">{renderMatchList(inProgressMatches)}</TabsContent>
                <TabsContent value="open" className="mt-2">{renderMatchList(openMatches)}</TabsContent>
                <TabsContent value="waiting" className="mt-2">{renderMatchList(waitingMatches)}</TabsContent>
                <TabsContent value="finished" className="mt-2">{renderMatchList(finishedMatches)}</TabsContent>
                </Tabs>
            </div>

            {/* SEÇÃO DE CARTELAS */}
            <div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <h2 className="font-heading text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
                    <Ticket className="w-6 h-6 text-primary" /> Minhas Cartelas
                </h2>
                <Dialog open={isCreateCardOpen} onOpenChange={setCreateCardOpen}>
                    <DialogTrigger asChild>
                        <Button className="gradient-primary shadow-button h-11 px-6 font-bold w-full sm:w-auto">
                        <Plus className="w-5 h-5 mr-2" />CRIAR NOVA CARTELA
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
                                    <span className="text-[10px] text-muted-foreground mt-1">{Number(profile.credits || 0).toFixed(2)} cr.</span>
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
                                    <span className="text-[10px] text-muted-foreground mt-1">{Number(profile.fake_credits || 0).toFixed(2)} cr.</span>
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
                            Salvar (Custa {Number(useGame().gameSettings?.custo_nova_cartela || 10).toFixed(2)} cr.)
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                </div>

                <Tabs defaultValue="active" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4 h-10 bg-muted/30">
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
        </div>
      </div>

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
              <span className="font-heading font-semibold text-base md:text-lg">Total: {Number(cardsToJoin.size * (selectedMatch?.card_price || 0)).toFixed(2)} créditos</span>
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