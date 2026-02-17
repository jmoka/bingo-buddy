import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Match, MatchStatus, CreditType, PlayerCard } from '@/types/match';
import { gameTypeLabels } from '@/utils/bingoUtils';
import { 
  LogOut, Coins, Plus, Trophy, Users, Settings, Wallet, 
  CreditCard, Timer, DoorOpen, Ticket, Zap, ZapOff, Tv, Printer, User as UserIcon,
  RefreshCw, Star, Trash2, History, Banknote
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
import { CreditRequestDialog } from '@/components/CreditRequestDialog';
import { MyCreditRequestsDialog } from '@/components/MyCreditRequestsDialog';
import { RedeemRequestDialog } from '@/components/RedeemRequestDialog';
import { MyRedeemRequestsDialog } from '@/components/MyRedeemRequestsDialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Lobby = () => {
  const navigate = useNavigate();
  const { session, profile, signOut } = useAuth();
  const { 
    matches, joinMatch, getPlayerMatchCards, playerCards, 
    buyCardUses, createPlayerCard, deletePlayerCard,
    matchCards, gameSettings, wins,
    redeemRequests, renewFakeCredits
  } = useGame();

  const [isSoundOn] = useState(true);
  const prevMatchesRef = useRef<Match[]>([]);

  const [isCreateCardOpen, setCreateCardOpen] = useState(false);
  const [newCardName, setNewCardName] = useState('');
  const [newCardNumbers, setNewCardNumbers] = useState<number[][] | null>(null);
  const [newCardCreditType, setNewCardCreditType] = useState<CreditType>('real');

  const [isJoinDialogOpen, setJoinDialogOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [cardsToJoin, setCardsToJoin] = useState<Set<string>>(new Set());
  
  const [rechargeCard, setRechargeCard] = useState<PlayerCard | null>(null);

  useEffect(() => {
    if (!session) {
      navigate('/login');
    }
  }, [session, navigate]);

  // Filtramos apenas pelo player_id, removendo o filtro de is_archived que não existe no banco
  const myOwnedCards = profile ? playerCards.filter(c => c.player_id === profile.id) : [];
  const realCards = myOwnedCards.filter(c => c.credit_type === 'real');
  const fakeCards = myOwnedCards.filter(c => c.credit_type === 'fake');

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
    const card = await createPlayerCard({ name: newCardName, numbers: newCardNumbers, creditType: newCardCreditType });
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

  const handleBuyUses = async (cardId: string, creditType: CreditType) => {
    const success = await buyCardUses(cardId, creditType);
    if (success) {
      toast.success('Cartela Recarregada!', { description: `Você comprou mais usos para sua cartela.` });
      setRechargeCard(null);
    }
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

  const renderCardList = (cards: PlayerCard[]) => {
    if (cards.length === 0) {
      return (
        <div className="card-container text-center py-8">
          <p className="text-sm text-muted-foreground">Você não tem cartelas nesta categoria.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map(card => {
          const activeMatchCard = matchCards.find(mc => mc.player_card_id === card.id && activeMatchIds.has(mc.match_id));
          const matchForCard = activeMatchCard ? matches.find(m => m.id === activeMatchCard.match_id) : null;
          const markedNumbers = activeMatchCard ? activeMatchCard.marked_numbers : new Set<number>();
          const winCount = wins.filter(w => w.player_card_id === card.id).length;
          return (
            <div key={card.id} className={`card-container p-3 transition-opacity ${card.uses_left === 0 ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-heading font-semibold text-sm md:text-base text-foreground">{card.name}</h3>
                    {card.credit_type === 'fake' ? (
                      <Badge variant="outline" className="border-amber-500/50 text-amber-600">Brincar</Badge>
                    ) : (
                      <Badge variant="outline" className="border-primary/50 text-primary">Real</Badge>
                    )}
                    {winCount > 0 && <div className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-600"><Trophy className="w-3 h-3" /><span>{winCount}x</span></div>}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">ID: ...{card.id.slice(-6).toUpperCase()}</p>
                </div>
                <div className="flex items-center gap-1">
                  <div className={`flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full ${card.uses_left > 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {card.uses_left > 0 ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
                    <span>{card.uses_left} uso(s)</span>
                  </div>
                  {card.uses_left === 0 && <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setRechargeCard(card)}>Recarregar <Coins className="w-3 h-3 ml-1" /></Button>}
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button size="icon" variant="ghost" disabled={winCount > 0} className="text-destructive/70 h-7 w-7"><Trash2 className="w-3.5 h-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Isso excluirá permanentemente a cartela "{card.name}".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deletePlayerCard(card.id)}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              {matchForCard && (
                <div className="mb-2 p-2 rounded-lg bg-accent/10 text-accent text-xs font-semibold flex items-center gap-2">
                  <Tv className="w-4 h-4" />
                  <div className="flex flex-col">
                    <span>Em jogo na partida:</span>
                    <span className="font-bold">{matchForCard.name}</span>
                  </div>
                </div>
              )}
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="gradient-hero py-4 px-4">
        <div className="container max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-heading text-xl md:text-2xl font-bold text-primary-foreground">🎱 Bingo</h1>
            <p className="text-primary-foreground/70 text-[10px] md:text-xs">Olá, {profile.full_name || 'Jogador'}!</p>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-2 bg-primary-foreground/10 rounded-full px-3 py-1.5 md:px-4 md:py-2">
              <div className="flex items-center gap-1" title="Créditos Reais">
                <Wallet className="w-3.5 h-3.5 text-primary-foreground" />
                <span className="font-heading font-bold text-sm md:text-base text-primary-foreground">{profile.credits}</span>
              </div>
              <div className="border-l border-primary-foreground/20 h-4"></div>
              <div className="flex items-center gap-1" title="Créditos de Brincar">
                <Star className="w-3.5 h-3.5 text-amber-300" />
                <span className="font-heading font-bold text-sm md:text-base text-primary-foreground">{profile.fake_credits}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
                <CreditRequestDialog gameSettings={gameSettings}>
                <Button size="sm" variant="ghost" className="text-primary-foreground h-8 px-2 md:h-9 md:px-3 text-xs md:text-sm">
                    <Plus className="w-3.5 h-3.5 mr-1" />Créditos
                </Button>
                </CreditRequestDialog>
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
            <Button variant="outline" size="sm" className="rounded-full bg-card whitespace-nowrap text-xs md:text-sm" onClick={renewFakeCredits}>
                <RefreshCw className="w-4 h-4 mr-2" /> Renovar Brincar
            </Button>
        </div>

        <div className="mb-8">
          <Tabs defaultValue="real">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="font-heading text-lg md:text-xl font-bold text-foreground flex items-center gap-2"><Ticket className="w-5 h-5 text-primary" /> Minhas Cartelas</h2>
                <TabsList>
                  <TabsTrigger value="real">Reais ({realCards.length})</TabsTrigger>
                  <TabsTrigger value="fake">De Brincar ({fakeCards.length})</TabsTrigger>
                </TabsList>
              </div>
              <Dialog open={isCreateCardOpen} onOpenChange={setCreateCardOpen}>
                <DialogTrigger asChild><Button size="sm" className="gradient-primary shadow-button h-8 md:h-9 text-xs md:text-sm"><Plus className="w-4 h-4 mr-2" />Criar Cartela</Button></DialogTrigger>
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                    <DialogTitle className="font-heading">Criar Nova Cartela</DialogTitle>
                    <DialogDescription>Escolha os números e o tipo de crédito para usar.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <RadioGroup value={newCardCreditType} onValueChange={(v: CreditType) => setNewCardCreditType(v)} className="grid grid-cols-2 gap-4">
                        <div>
                          <RadioGroupItem value="real" id="real" className="peer sr-only" />
                          <Label htmlFor="real" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                            Créditos Reais
                            <span className="font-bold text-lg">{profile.credits}</span>
                          </Label>
                        </div>
                        <div>
                          <RadioGroupItem value="fake" id="fake" className="peer sr-only" />
                          <Label htmlFor="fake" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                            De Brincar
                            <span className="font-bold text-lg">{profile.fake_credits}</span>
                          </Label>
                        </div>
                      </RadioGroup>
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
            <TabsContent value="real">
              {renderCardList(realCards)}
            </TabsContent>
            <TabsContent value="fake">
              {renderCardList(fakeCards)}
            </TabsContent>
          </Tabs>
        </div>

        <h2 className="font-heading text-lg md:text-xl font-bold text-foreground mb-4 flex items-center gap-2"><DoorOpen className="w-5 h-5 text-accent" /> Partidas</h2>
        <div className="space-y-4">
            {sortedMatches.map(match => {
              const playersInMatchCount = new Set(matchCards.filter(mc => mc.match_id === match.id).map(mc => mc.player_id)).size;
              const myMatchCards = getPlayerMatchCards(match.id, profile.id);
              const alreadyJoined = myMatchCards.length > 0;
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
                          <Button size="sm" className="bg-success/10 text-success hover:bg-success/20 h-8 text-xs" onClick={() => navigate(`/match/${match.id}`)}><Tv className="w-3.h-3.5 mr-2" /> Acompanhar</Button>
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
      </main>

      <Dialog open={isJoinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">Entrar na Partida</DialogTitle><DialogDescription>Selecione as cartelas que deseja usar.</DialogDescription></DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto p-1 space-y-3">
            {profile && myOwnedCards.filter(card => !new Set(getPlayerMatchCards(selectedMatch?.id || '', profile.id).map(c => c.player_card_id)).has(card.id)).map(card => {
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

      <AlertDialog open={!!rechargeCard} onOpenChange={(isOpen) => !isOpen && setRechargeCard(null)}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Recarregar Cartela "{rechargeCard?.name}"</AlertDialogTitle>
                <AlertDialogDescription>
                    A recarga custará {gameSettings?.custo_recarga_cartela} créditos. Escolha qual saldo usar para a recarga.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-2 gap-4 my-4">
                <div className="text-center p-4 border rounded-lg flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        <span className="font-bold text-lg">Reais</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Saldo: {profile.credits}</span>
                </div>
                <div className="text-center p-4 border rounded-lg flex flex-col items-center justify-center">
                    <div className="flex items-center gap-2 mb-2">
                        <Star className="w-5 h-5 text-amber-500" />
                        <span className="font-bold text-lg">De Brincar</span>
                    </div>
                    <span className="text-sm text-muted-foreground">Saldo: {profile.fake_credits}</span>
                </div>
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <Button 
                    variant="outline" 
                    onClick={() => handleBuyUses(rechargeCard!.id, 'fake')}
                    disabled={profile.fake_credits < (gameSettings?.custo_recarga_cartela || 0)}
                >
                    Usar de Brincar
                </Button>
                <Button 
                    onClick={() => handleBuyUses(rechargeCard!.id, 'real')}
                    disabled={profile.credits < (gameSettings?.custo_recarga_cartela || 0)}
                >
                    Usar Reais
                </Button>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
};

export default Lobby;